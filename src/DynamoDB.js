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
    this._timeframeMinutes = 5;
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

  async describeTableConsumedCapacityAsync(params) {
    let sw = stats.timer('DynamoDB.describeTableConsumedCapacityAsync').start();
    try {
      // Make all the requests concurrently
      let tableRead = this.getConsumedCapacityAsync(true, params.TableName, null);
      let tableWrite = this.getConsumedCapacityAsync(false, params.TableName, null);
      let gsiReads = this.getArrayOrDefault(params.GlobalSecondaryIndexes).map(gsi => this.getConsumedCapacityAsync(true, params.TableName, gsi.IndexName));
      let gsiWrites = this.getArrayOrDefault(params.GlobalSecondaryIndexes).map(gsi => this.getConsumedCapacityAsync(true, params.TableName, gsi.IndexName));

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

  getArrayOrDefault(value) {
    return value || [];
  }

  getAverageValue(data) {
    return data.data.Datapoints.length === 0 ? 0 : data.data.Datapoints[0].Average;
  }

  async getConsumedCapacityAsync(isRead, tableName, globalSecondaryIndexName) {
    let EndTime = new Date();
    let StartTime = new Date();
    StartTime.setTime(EndTime - (60000 * this._timeframeMinutes));
    let MetricName = isRead ? 'ConsumedReadCapacityUnits' : 'ConsumedWriteCapacityUnits';
    let Dimensions = this.getDimensions(tableName, globalSecondaryIndexName);
    let params = {
        Namespace: 'AWS/DynamoDB',
        MetricName,
        Dimensions,
        StartTime,
        EndTime,
        Period: (this._timeframeMinutes * 60),
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
