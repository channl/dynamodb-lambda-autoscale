import AWS from 'aws-sdk-promise';
import CloudWatch from './CloudWatch';
import {
  json,
  stats,
  warning,
  invariant } from '../src/Global';

export default class DynamoDB {
  constructor(dynamoOptions, cloudWatchOptions) {
    invariant(typeof dynamoOptions !== 'undefined',
      'Parameter \'dynamoOptions\' is not set');
    invariant(typeof cloudWatchOptions !== 'undefined',
      'Parameter \'cloudWatchOptions\' is not set');

    this._db = new AWS.DynamoDB(dynamoOptions);
    this._cw = new CloudWatch(cloudWatchOptions);
  }

  async listTablesAsync() {
    let sw = stats.timer('DynamoDB.listTablesAsync').start();
    try {
      let res = await this._db.listTables().promise();
      return res.data;
    } catch (ex) {
      warning(JSON.stringify({
        class: 'DynamoDB',
        function: 'listTablesAsync'
      }, null, json.padding));
      throw ex;
    } finally {
      sw.end();
    }
  }

  async describeTableAsync(params) {
    let sw = stats.timer('DynamoDB.describeTableAsync').start();
    try {
      invariant(typeof params !== 'undefined',
        'Parameter \'params\' is not set');

      let res = await this._db.describeTable(params).promise();
      return res.data;
    } catch (ex) {
      warning(JSON.stringify({
        class: 'DynamoDB',
        function: 'describeTableAsync',
        params
      }, null, json.padding));
      throw ex;
    } finally {
      sw.end();
    }
  }

  async updateTableAsync(params) {
    let sw = stats.timer('DynamoDB.updateTableAsync').start();
    try {
      invariant(typeof params !== 'undefined',
        'Parameter \'params\' is not set');

      let res = this._db.updateTable(params).promise();
      return res.data;
    } catch (ex) {
      warning(JSON.stringify({
        class: 'DynamoDB',
        function: 'updateTableAsync',
        params
      }, null, json.padding));
      throw ex;
    } finally {
      sw.end();
    }
  }

  async describeTableConsumedCapacityAsync(params, periodMinutes) {
    let sw = stats
      .timer('DynamoDB.describeTableConsumedCapacityAsync')
      .start();

    try {
      invariant(typeof params !== 'undefined',
        'Parameter \'params\' is not set');
      invariant(typeof periodMinutes !== 'undefined',
        'Parameter \'periodMinutes\' is not set');

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
      warning(JSON.stringify({
        class: 'DynamoDB',
        function: 'describeTableConsumedCapacityAsync',
        params,
        periodMinutes
      }, null, json.padding));
      throw ex;
    } finally {
      sw.end();
    }
  }

  getTotalTableProvisionedThroughput(params) {
    try {
      invariant(typeof params !== 'undefined',
        'Parameter \'params\' is not set');

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
      warning(JSON.stringify({
        class: 'DynamoDB',
        function: 'getTotalTableProvisionedThroughput',
        params
      }, null, json.padding));
      throw ex;
    }
  }

  getMonthlyEstimatedTableCost(provisionedThroughput) {
    try {
      invariant(typeof provisionedThroughput !== 'undefined',
        'Parameter \'provisionedThroughput\' is not set');

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
      warning(JSON.stringify({
        class: 'DynamoDB',
        function: 'getMonthlyEstimatedTableCost',
        provisionedThroughput
      }, null, json.padding));
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

    try {
      invariant(typeof isRead !== 'undefined',
        'Parameter \'isRead\' is not set');
      invariant(typeof tableName !== 'undefined',
        'Parameter \'tableName\' is not set');
      invariant(typeof globalSecondaryIndexName !== 'undefined',
        'Parameter \'globalSecondaryIndexName\' is not set');
      invariant(typeof periodMinutes !== 'undefined',
        'Parameter \'periodMinutes\' is not set');

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
      warning(JSON.stringify({
        class: 'DynamoDB',
        function: 'getConsumedCapacityAsync',
        isRead, tableName, globalSecondaryIndexName, periodMinutes
      }, null, json.padding));
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
