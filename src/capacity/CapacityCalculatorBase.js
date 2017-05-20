/* @flow */
import CloudWatch from '../aws/CloudWatch';
import Instrument from '../logging/Instrument';
import invariant from 'invariant';
import type {
  TableConsumedCapacityDescription,
  StatisticSettings,
  ConsumedCapacityDesc,
} from '../flow/FlowTypes';
import type {
  TableDescription,
  GetMetricStatisticsResponse,
  Dimension,
} from 'aws-sdk';

export default class CapacityCalculatorBase {
  cw: CloudWatch;

  constructor() {
    this.cw = CloudWatch.create(this.getCloudWatchRegion());
  }

  // Get the region
  getCloudWatchRegion(): string {
    invariant(false, 'The method \'getCloudWatchRegion\' was not implemented');
  }

  // Gets the settings used to fetch the consumed throughput statistics
  getStatisticSettings(): StatisticSettings {
    invariant(false, 'The method \'getStatisticSettings\' was not implemented');
  }

  // Gets the settings used to fetch the throttled events statistics
  getThrottledEventStatisticSettings(): StatisticSettings {
    invariant(false, 'The method \'getThrottledEventStatisticSettings\' was not implemented');
  }

  // Gets the projected capacity value based on the cloudwatch datapoints
  // eslint-disable-next-line no-unused-vars
  getProjectedValue(settings: StatisticSettings, data: GetMetricStatisticsResponse): number {
    invariant(false, 'The method \'getProjectedValue\' was not implemented');
  }

  // $FlowIgnore
  @Instrument.timer()
  async describeTableConsumedCapacityAsync(params: TableDescription)
    : Promise<TableConsumedCapacityDescription> {

    invariant(params != null, 'Parameter \'params\' is not set');

    // Make all the requests concurrently
    let tableRead = this.getConsumedCapacityAsync(true, params.TableName, null);
    let tableWrite = this.getConsumedCapacityAsync(false, params.TableName, null);

    let gsiReads = (params.GlobalSecondaryIndexes || [])
      .map(gsi => this.getConsumedCapacityAsync(true, params.TableName, gsi.IndexName));

    let gsiWrites = (params.GlobalSecondaryIndexes || [])
      .map(gsi => this.getConsumedCapacityAsync(false, params.TableName, gsi.IndexName));

    let tableTRead = this.getThrottledEventsAsync(true, params.TableName, null);
    let tableTWrites = this.getThrottledEventsAsync(false, params.TableName, null);

    let gsiTReads = (params.GlobalSecondaryIndexes || [])
      .map(gsi => this.getThrottledEventsAsync(true, params.TableName, gsi.IndexName));

    let gsiTWrites = (params.GlobalSecondaryIndexes || [])
      .map(gsi => this.getThrottledEventsAsync(false, params.TableName, gsi.IndexName));

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

  async getConsumedCapacityAsync(
    isRead: boolean, tableName: string, globalSecondaryIndexName: ?string):
    Promise<ConsumedCapacityDesc> {
    invariant(isRead != null, 'Parameter \'isRead\' is not set');
    invariant(tableName != null, 'Parameter \'tableName\' is not set');

    let settings = this.getStatisticSettings();

    let EndTime = new Date();
    let StartTime = new Date();
    StartTime.setTime(EndTime - (60000 * settings.spanMinutes * settings.count));
    let MetricName = isRead ? 'ConsumedReadCapacityUnits' : 'ConsumedWriteCapacityUnits';
    let Dimensions = this.getDimensions(tableName, globalSecondaryIndexName);
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

    let statistics = await this.cw.getMetricStatisticsAsync(params);
    let value = this.getProjectedValue(settings, statistics);
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

  async getThrottledEventsAsync(
    isRead: boolean, tableName: string, globalSecondaryIndexName: ?string):
    Promise<number> {
    invariant(isRead != null, 'Parameter \'isRead\' is not set');
    invariant(tableName != null, 'Parameter \'tableName\' is not set');

    let settings = this.getThrottledEventStatisticSettings();

    let EndTime = new Date();
    let StartTime = new Date();
    StartTime.setTime(EndTime - (60000 * settings.spanMinutes * settings.count));
    let MetricName = isRead ? 'ReadThrottleEvents' : 'WriteThrottleEvents';
    let Dimensions = this.getDimensions(tableName, globalSecondaryIndexName);
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

    let statistics = await this.cw.getMetricStatisticsAsync(params);
    let value = this.getProjectedValue(settings, statistics);
    return value;
  }

  getDimensions(tableName: string, globalSecondaryIndexName: ?string): Dimension[] {
    if (globalSecondaryIndexName) {
      return [
        { Name: 'TableName', Value: tableName},
        { Name: 'GlobalSecondaryIndexName', Value: globalSecondaryIndexName}
      ];
    }

    return [ { Name: 'TableName', Value: tableName} ];
  }
}
