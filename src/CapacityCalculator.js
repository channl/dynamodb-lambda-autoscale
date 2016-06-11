/* @flow */
import { json, stats, warning, invariant } from './Global';
import CloudWatch from './CloudWatch';
import type {
  TableDescription, GetMetricStatisticsResponse, Dimension,
  TableConsumedCapacityDescription } from './FlowTypes';

export default class CapacityCalculator {
  _cw: CloudWatch;

  constructor(cloudWatch: CloudWatch) {
    invariant(typeof cloudWatch !== 'undefined', 'Parameter \'cloudWatch\' is not set');
    this._cw = cloudWatch;
  }

  async describeTableConsumedCapacityAsync(params: TableDescription)
    : Promise<TableConsumedCapacityDescription> {
    let sw = stats
      .timer('DynamoDB.describeTableConsumedCapacityAsync')
      .start();

    try {
      invariant(typeof params !== 'undefined', 'Parameter \'params\' is not set');

      // Make all the requests concurrently
      let tableRead = this.getConsumedCapacityAsync(true, params.TableName, null);
      let tableWrite = this.getConsumedCapacityAsync(false, params.TableName, null);

      let gsiReads = (params.GlobalSecondaryIndexes || [])
        .map(gsi => this.getConsumedCapacityAsync(true, params.TableName, gsi.IndexName));

      let gsiWrites = (params.GlobalSecondaryIndexes || [])
        .map(gsi => this.getConsumedCapacityAsync(false, params.TableName, gsi.IndexName));

      // Await on the results
      let tableConsumedRead = await tableRead;
      let tableConsumedWrite = await tableWrite;
      let gsiConsumedReads = await Promise.all(gsiReads);
      let gsiConsumedWrites = await Promise.all(gsiWrites);

      // Format results
      let gsis = gsiConsumedReads.map((read, i) => {
        let write = gsiConsumedWrites[i];
        return {
          // $FlowIgnore: The indexName is not null in this case
          IndexName: read.globalSecondaryIndexName,
          ConsumedThroughput: {
            ReadCapacityUnits: read.value,
            WriteCapacityUnits: write.value
          }
        };
      });

      return {
        TableName: params.TableName,
        ConsumedThroughput: {
          ReadCapacityUnits: tableConsumedRead.value,
          WriteCapacityUnits: tableConsumedWrite.value
        },
        GlobalSecondaryIndexes: gsis
      };
    } catch (ex) {
      warning(JSON.stringify({
        class: 'CapacityCalculator',
        function: 'describeTableConsumedCapacityAsync',
        params,
      }, null, json.padding));
      throw ex;
    } finally {
      sw.end();
    }
  }

  async getConsumedCapacityAsync(
    isRead: boolean, tableName: string, globalSecondaryIndexName: ?string) {
    try {
      invariant(typeof isRead !== 'undefined', 'Parameter \'isRead\' is not set');
      invariant(typeof tableName !== 'undefined', 'Parameter \'tableName\' is not set');
      invariant(typeof globalSecondaryIndexName !== 'undefined',
        'Parameter \'globalSecondaryIndexName\' is not set');

      // These values determine how many minutes worth of metrics
      let durationMinutes = 5;
      let periodMinutes = 1;

      let EndTime = new Date();
      let StartTime = new Date();
      StartTime.setTime(EndTime - (60000 * durationMinutes));
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

      let statistics = await this._cw.getMetricStatisticsAsync(params);
      let value = this.getProjectedValue(statistics);
      return {
        tableName,
        globalSecondaryIndexName,
        value
      };
    } catch (ex) {
      warning(JSON.stringify({
        class: 'CapacityCalculator',
        function: 'getConsumedCapacityAsync',
        isRead, tableName, globalSecondaryIndexName,
      }, null, json.padding));
      throw ex;
    }
  }

  getProjectedValue(data: GetMetricStatisticsResponse) {
    if (data.Datapoints.length === 0) {
      return 0;
    }

    // Default algorithm for projecting a good value for the current ConsumedThroughput is:
    // 1. Query 5 average readings each spanning a minute
    // 2. Select the Max value from those 5 readings
    let averages = data.Datapoints.map(dp => dp.Average);
    let value = Math.max(...averages);
    return value;
  }

  getDimensions(tableName: string, globalSecondaryIndexName: ?string): Dimension[] {
    if (globalSecondaryIndexName) {
      return [
        { Name: 'TableName', Value: tableName},
        { Name: 'GlobalSecondaryIndex', Value: globalSecondaryIndexName}
      ];
    }

    return [ { Name: 'TableName', Value: tableName} ];
  }
}
