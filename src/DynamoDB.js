import AWS from 'aws-sdk';
import Global from './global';
import CloudWatch from './CloudWatch';
const {
  stats,
  logger
} = Global;

export default class DynamoDB {
  constructor(dynamoOptions, cloudWatchOptions) {
    this._db = new AWS.DynamoDB(dynamoOptions);
    this._cw = new CloudWatch(cloudWatchOptions);
  }

  async listTablesAsync() {
    let sw = stats.timer('DynamoDB.listTablesAsync').start()
    try {
      return await this._db.listTables().promise();
    }
    finally {
      sw.end();
    }
  }

  async describeTableAsync(params) {
    let sw = stats.timer('DynamoDB.describeTableAsync').start();
    try {
      return await this._db.describeTable(params).promise();
    }
    finally {
      sw.end();
    }
  }

  async updateTableAsync(params) {
    let sw = stats.timer('DynamoDB.updateTableAsync').start();
    try {
      return this._db.updateTable(params).promise();
    }
    finally {
      sw.end();
    }
  }

  async describeTableConsumedCapacityAsync(params, periodMinutes) {
    let sw = stats.timer('DynamoDB.describeTableConsumedCapacityAsync').start();
    try {
      // Make all the requests concurrently
      let tableRead = this.getConsumedCapacityAsync(true, params.TableName, null, periodMinutes);
      let tableWrite = this.getConsumedCapacityAsync(false, params.TableName, null, periodMinutes);
      let gsiReads = this.getArrayOrDefault(params.GlobalSecondaryIndexes).map(gsi => this.getConsumedCapacityAsync(true, params.TableName, gsi.IndexName, periodMinutes));
      let gsiWrites = this.getArrayOrDefault(params.GlobalSecondaryIndexes).map(gsi => this.getConsumedCapacityAsync(true, params.TableName, gsi.IndexName, periodMinutes));

      // Await on the results
      let tableConsumedRead = await tableRead;
      let tableConsumedWrite = await tableWrite;
      let gsiConsumedReads = await Promise.all(gsiReads);
      let gsiConsumedWrites = await Promise.all(gsiWrites);

      // Format results
      let gsis = gsiConsumedReads.map((read, i) => {
        let write = gsiConsumedWrites[i];
        return {
          IndexName: read.globalSecondaryIndexName,
          ConsumedThroughput: {
            ReadCapacityUnits: this.getAverageValue(read),
            WriteCapacityUnits: this.getAverageValue(write)
          }
        };
      });

      return {
        Table: {
          TableName: params.TableName,
          ConsumedThroughput: {
            ReadCapacityUnits: this.getAverageValue(tableConsumedRead),
            WriteCapacityUnits: this.getAverageValue(tableConsumedWrite)
          },
          GlobalSecondaryIndexes: gsis
        }
      };
    }
    finally {
      sw.end();
    }
  }

  getTotalTableProvisionedThroughput(params) {
    let ReadCapacityUnits = params.Table.ProvisionedThroughput.ReadCapacityUnits;
    let WriteCapacityUnits = params.Table.ProvisionedThroughput.WriteCapacityUnits;

    if (params.Table.GlobalSecondaryIndexes) {
      ReadCapacityUnits += params.Table.GlobalSecondaryIndexes.reduce((prev, curr, i) => prev + curr.ProvisionedThroughput.ReadCapacityUnits, 0);
      WriteCapacityUnits += params.Table.GlobalSecondaryIndexes.reduce((prev, curr, i) => prev + curr.ProvisionedThroughput.WriteCapacityUnits, 0);
    }

    return {
      ReadCapacityUnits,
      WriteCapacityUnits
    };
  }

  getMonthlyEstimatedTableCost(provisionedThroughput) {
    const averageHoursPerMonth = 720;
    const readCostPerHour = 0.0065;
    const readCostUnits = 50;
    const writeCostPerHour = 0.0065;
    const writeCostUnits = 10;

    let readCost = provisionedThroughput.ReadCapacityUnits / readCostUnits * readCostPerHour * averageHoursPerMonth;
    let writeCost = provisionedThroughput.WriteCapacityUnits / writeCostUnits * writeCostPerHour * averageHoursPerMonth;

    return readCost + writeCost;
  }

  getArrayOrDefault(value) {
    return value || [];
  }

  getAverageValue(data) {
    return data.data.Datapoints.length === 0 ? 0 : data.data.Datapoints[0].Average;
  }

  async getConsumedCapacityAsync(isRead, tableName, globalSecondaryIndexName, periodMinutes) {
    let EndTime = new Date();
    let StartTime = new Date();
    StartTime.setTime(EndTime - (60000 * periodMinutes));
    let MetricName = isRead ? 'ConsumedReadCapacityUnits' : 'ConsumedWriteCapacityUnits';
    let Dimensions = this.getDimensions(tableName, globalSecondaryIndexName);
    let params = {
        Namespace: 'AWS/DynamoDB',
        MetricName,
        Dimensions,
        StartTime,
        EndTime,
        Period: (periodMinutes * 60),
        Statistics: [ 'Average' ],
        Unit: 'Count'
    };

    let data = await this._cw.getMetricStatisticsAsync(params);
    return {
      tableName,
      globalSecondaryIndexName,
      data
    };
  }

  getDimensions(tableName, globalSecondaryIndexName) {
    if (globalSecondaryIndexName) {
      return [
        { Name: 'TableName', Value: tableName},
        { Name: 'GlobalSecondaryIndex', Value: globalSecondaryIndexName}
      ];
    }

    return [{ Name: 'TableName', Value: tableName}];
  }
}
