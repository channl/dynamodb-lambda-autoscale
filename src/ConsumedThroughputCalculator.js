/* @flow */
import Instrument from './logging/Instrument';
import invariant from 'invariant';
import type { TableConsumedCapacityDescription, StatisticSettings, ConsumedCapacityDesc } from './flow/FlowTypes';
import type { TableDescription, GetMetricStatisticsResponse, Dimension, GetMetricStatisticsRequest } from 'aws-sdk';

export default class ConsumedThroughputCalculator {
  _getMetricStatisticsAsync: (params: GetMetricStatisticsRequest) => Promise<GetMetricStatisticsResponse>;

  constructor(
    getMetricStatisticsAsync: (params: GetMetricStatisticsRequest) => Promise<GetMetricStatisticsResponse>) {
    this._getMetricStatisticsAsync = getMetricStatisticsAsync;
  }

  // $FlowIgnore
  @Instrument.timer()
  async describeTableConsumedCapacityAsync(params: TableDescription): Promise<TableConsumedCapacityDescription> {
    invariant(params != null, 'Parameter \'params\' is not set');

    // Make all the requests concurrently
    let tableRead = this._getConsumedCapacityAsync(true, params.TableName, null);
    let tableWrite = this._getConsumedCapacityAsync(false, params.TableName, null);

    let gsiReads = (params.GlobalSecondaryIndexes || [])
      .map(gsi => this._getConsumedCapacityAsync(true, params.TableName, gsi.IndexName));

    let gsiWrites = (params.GlobalSecondaryIndexes || [])
      .map(gsi => this._getConsumedCapacityAsync(false, params.TableName, gsi.IndexName));

    let tableTRead = this._getThrottledEventsAsync(true, params.TableName, null);
    let tableTWrites = this._getThrottledEventsAsync(false, params.TableName, null);

    let gsiTReads = (params.GlobalSecondaryIndexes || [])
      .map(gsi => this._getThrottledEventsAsync(true, params.TableName, gsi.IndexName));

    let gsiTWrites = (params.GlobalSecondaryIndexes || [])
      .map(gsi => this._getThrottledEventsAsync(false, params.TableName, gsi.IndexName));

    // Await on the results
    let tableConsumedRead = await tableRead;
    let tableConsumedWrite = await tableWrite;
    let gsiConsumedReads = await Promise.all(gsiReads);
    let gsiConsumedWrites = await Promise.all(gsiWrites);

    // Await on throttled info
    let tableThrottledRead = await tableTRead;
    let tableThrottledWrite = await tableTWrites;
    let gsiThrottledReads = await Promise.all(gsiTReads);
    let gsiThrottledWrites = await Promise.all(gsiTWrites);

    // Format results
    let gsis = gsiConsumedReads.map((read, i) => {
      let write = gsiConsumedWrites[i];
      let throttledWrite = gsiThrottledWrites[i];
      let throttledRead = gsiThrottledReads[i];
      let gsiIndexName = read.globalSecondaryIndexName;
      invariant(gsiIndexName != null, '\'gsiIndexName\' was null');
      return {
        IndexName: gsiIndexName,
        ConsumedThroughput: {
          ReadCapacityUnits: read.value,
          WriteCapacityUnits: write.value
        },
        ThrottledEvents: {
          ThrottledReadEvents: throttledRead,
          ThrottledWriteEvents: throttledWrite
        }
      };
    });

    return {
      TableName: params.TableName,
      ConsumedThroughput: {
        ReadCapacityUnits: tableConsumedRead.value,
        WriteCapacityUnits: tableConsumedWrite.value
      },
      ThrottledEvents: {
        ThrottledReadEvents: tableThrottledRead,
        ThrottledWriteEvents: tableThrottledWrite
      },
      GlobalSecondaryIndexes: gsis
    };
  }

  async _getConsumedCapacityAsync(
    isRead: boolean, tableName: string, globalSecondaryIndexName: ?string):
    Promise<ConsumedCapacityDesc> {
    invariant(isRead != null, 'Parameter \'isRead\' is not set');
    invariant(tableName != null, 'Parameter \'tableName\' is not set');

    let settings = this._getStatisticSettings();

    let EndTime = new Date();
    let StartTime = new Date();
    StartTime.setTime(EndTime - (60000 * settings.spanMinutes * settings.count));
    let MetricName = isRead ? 'ConsumedReadCapacityUnits' : 'ConsumedWriteCapacityUnits';
    let Dimensions = this._getDimensions(tableName, globalSecondaryIndexName);
    let period = (settings.spanMinutes * 60);
    let params = {
      Namespace: 'AWS/DynamoDB',
      MetricName,
      Dimensions,
      StartTime,
      EndTime,
      Period: period,
      Statistics: [ settings.type ],
      Unit: 'Count'
    };

    let statistics = await this._getMetricStatisticsAsync(params);
    let value = this._getProjectedValue(settings, statistics);
    let result: ConsumedCapacityDesc = {
      tableName,
      globalSecondaryIndexName,
      value
    };

/*
    log(JSON.stringify({
      ...result,
      statistics: statistics.Datapoints.map(dp => dp.Sum / (settings.spanMinutes * 60)),
    }));
*/

    return result;
  }

  async _getThrottledEventsAsync(
    isRead: boolean, tableName: string, globalSecondaryIndexName: ?string):
    Promise<number> {
    invariant(isRead != null, 'Parameter \'isRead\' is not set');
    invariant(tableName != null, 'Parameter \'tableName\' is not set');

    let settings = this._getThrottledEventStatisticSettings();

    let EndTime = new Date();
    let StartTime = new Date();
    StartTime.setTime(EndTime - (60000 * settings.spanMinutes * settings.count));
    let MetricName = isRead ? 'ReadThrottleEvents' : 'WriteThrottleEvents';
    let Dimensions = this._getDimensions(tableName, globalSecondaryIndexName);
    let period = (settings.spanMinutes * 60);
    let params = {
      Namespace: 'AWS/DynamoDB',
      MetricName,
      Dimensions,
      StartTime,
      EndTime,
      Period: period,
      Statistics: [ settings.type ],
      Unit: 'Count'
    };

    let statistics = await this._getMetricStatisticsAsync(params);
    let value = this._getProjectedValue(settings, statistics);
    return value;
  }

  _getDimensions(tableName: string, globalSecondaryIndexName: ?string): Dimension[] {
    if (globalSecondaryIndexName) {
      return [
        { Name: 'TableName', Value: tableName},
        { Name: 'GlobalSecondaryIndexName', Value: globalSecondaryIndexName}
      ];
    }

    return [ { Name: 'TableName', Value: tableName} ];
  }

    // Gets the settings used to fetch the consumed throughput statistics
  _getStatisticSettings(): StatisticSettings {
    return {
      count: 5,
      spanMinutes: 1,
      type: 'Sum',
    };
  }

  // Gets the settings used to fetch the throttled events statistics
  _getThrottledEventStatisticSettings(): StatisticSettings {
    return {
      count: 1,
      spanMinutes: 1,
      type: 'Sum',
    };
  }

  // Gets the projected capacity value based on the cloudwatch datapoints
  _getProjectedValue(settings: StatisticSettings, data: GetMetricStatisticsResponse): number {
    invariant(data != null, 'Parameter \'data\' is not set');

    if (data.Datapoints.length === 0) {
      return 0;
    }

    // Default algorithm for projecting a good value for the current ConsumedThroughput is:
    // 1. Query 5 average readings each spanning a minute
    // 2. Select the Max value from those 5 readings
    let spanSeconds = settings.spanMinutes * 60;
    let averages = data.Datapoints.map(dp => dp.Sum / spanSeconds);
    let projectedValue = Math.max(...averages);
    return projectedValue;
  }
}
