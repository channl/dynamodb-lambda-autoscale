import AWS from 'aws-sdk-promise';
import Global from './Global';
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
    logger.debug('DynamoDB.listTablesAsync');
    let sw = stats.timer('DynamoDB.listTablesAsync').start();
    try {
      let res = await this._db.listTables().promise();
      return res.data;
    } catch (ex) {
      logger.warn('DynamoDB.listTablesAsync failed');
      throw ex;
    } finally {
      sw.end();
    }
  }

  async describeTableAsync(params) {
    logger.debug('DynamoDB.describeTableAsync');
    let sw = stats.timer('DynamoDB.describeTableAsync').start();
    try {
      let res = await this._db.describeTable(params).promise();
      return res.data;
    } catch (ex) {
      logger.warn(
        'DynamoDB.describeTableAsync failed',
        JSON.stringify({params}));
      throw ex;
    } finally {
      sw.end();
    }
  }

  async updateTableAsync(params) {
    logger.debug('DynamoDB.updateTableAsync');
    let sw = stats.timer('DynamoDB.updateTableAsync').start();
    try {
      let res = this._db.updateTable(params).promise();
      return res.data;
    } catch (ex) {
      logger.warn(
        'DynamoDB.updateTableAsync failed',
        JSON.stringify({params}));
      throw ex;
    } finally {
      sw.end();
    }
  }

  async describeTableConsumedCapacityAsync(params, periodMinutes) {
    logger.debug('DynamoDB.describeTableConsumedCapacityAsync');
    let sw = stats
      .timer('DynamoDB.describeTableConsumedCapacityAsync')
      .start();

    try {
      // Make all the requests concurrently
      let tableRead = this.getConsumedCapacityAsync(
        true, params.TableName, null, periodMinutes);

      let tableWrite = this.getConsumedCapacityAsync(
        false, params.TableName, null, periodMinutes);

      let gsiReads = this
        .getArrayOrDefault(params.GlobalSecondaryIndexes)
        .map(gsi => this.getConsumedCapacityAsync(
          true, params.TableName, gsi.IndexName, periodMinutes));

      let gsiWrites = this
        .getArrayOrDefault(params.GlobalSecondaryIndexes)
        .map(gsi => this.getConsumedCapacityAsync(
          false, params.TableName, gsi.IndexName, periodMinutes));

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
    } catch (ex) {
      logger.warn(
        'DynamoDB.describeTableConsumedCapacityAsync failed',
        JSON.stringify({params, periodMinutes}));
      throw ex;
    } finally {
      sw.end();
    }
  }

  getTotalTableProvisionedThroughput(params) {
    logger.debug('DynamoDB.getTotalTableProvisionedThroughput');
    try {
      let ReadCapacityUnits = params.Table
        .ProvisionedThroughput.ReadCapacityUnits;

      let WriteCapacityUnits = params.Table
        .ProvisionedThroughput.WriteCapacityUnits;

      if (params.Table.GlobalSecondaryIndexes) {
        ReadCapacityUnits += params.Table.GlobalSecondaryIndexes
          .reduce((prev, curr) =>
            prev + curr.ProvisionedThroughput.ReadCapacityUnits, 0);

        WriteCapacityUnits += params.Table.GlobalSecondaryIndexes
          .reduce((prev, curr) =>
            prev + curr.ProvisionedThroughput.WriteCapacityUnits, 0);
      }

      return {
        ReadCapacityUnits,
        WriteCapacityUnits
      };
    } catch (ex) {
      logger.warn(
        'DynamoDB.getTotalTableProvisionedThroughput failed',
        JSON.stringify({params}));
      throw ex;
    }
  }

  getMonthlyEstimatedTableCost(provisionedThroughput) {
    logger.debug('DynamoDB.getMonthlyEstimatedTableCost');
    try {
      const averageHoursPerMonth = 720;
      const readCostPerHour = 0.0065;
      const readCostUnits = 50;
      const writeCostPerHour = 0.0065;
      const writeCostUnits = 10;

      let readCost = provisionedThroughput.ReadCapacityUnits /
        readCostUnits * readCostPerHour * averageHoursPerMonth;

      let writeCost = provisionedThroughput.WriteCapacityUnits /
        writeCostUnits * writeCostPerHour * averageHoursPerMonth;

      return readCost + writeCost;
    } catch (ex) {
      logger.warn(
        'DynamoDB.getMonthlyEstimatedTableCost failed',
        JSON.stringify({provisionedThroughput}));

      throw ex;
    }
  }

  getArrayOrDefault(value) {
    return value || [];
  }

  getAverageValue(data) {
    return data.data.Datapoints.length === 0 ?
      0 : data.data.Datapoints[0].Average;
  }

  async getConsumedCapacityAsync(
    isRead, tableName, globalSecondaryIndexName, periodMinutes) {
    logger.debug('DynamoDB.getConsumedCapacityAsync');
    try {
      let EndTime = new Date();
      let StartTime = new Date();
      StartTime.setTime(EndTime - (60000 * periodMinutes));
      let MetricName = isRead ?
        'ConsumedReadCapacityUnits' : 'ConsumedWriteCapacityUnits';
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
    } catch (ex) {
      logger.warn(
        'DynamoDB.getConsumedCapacityAsync failed',
        JSON.stringify(
          {isRead, tableName, globalSecondaryIndexName, periodMinutes}));
      throw ex;
    }
  }

  getDimensions(tableName, globalSecondaryIndexName) {
    if (globalSecondaryIndexName) {
      return [
        { Name: 'TableName', Value: tableName},
        { Name: 'GlobalSecondaryIndex', Value: globalSecondaryIndexName}
      ];
    }

    return [ { Name: 'TableName', Value: tableName} ];
  }
}
