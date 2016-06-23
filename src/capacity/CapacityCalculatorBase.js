/* @flow */
import { json, stats, warning, invariant } from '../Global';
import CloudWatch from '../aws/CloudWatch';
import type {
  TableConsumedCapacityDescription,
  StatisticSettings,
  ConsumedCapacityDesc
} from '../flow/FlowTypes';
import type {
  TableDescription,
  GetMetricStatisticsResponse,
  Dimension,
} from 'aws-sdk-promise';

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

  // Gets the projected capacity value based on the cloudwatch datapoints
  // eslint-disable-next-line no-unused-vars
  getProjectedValue(data: GetMetricStatisticsResponse): number {
    invariant(false, 'The method \'getProjectedValue\' was not implemented');
  }

  async describeTableConsumedCapacityAsync(params: TableDescription)
    : Promise<TableConsumedCapacityDescription> {
    let sw = stats
      .timer('DynamoDB.describeTableConsumedCapacityAsync')
      .start();

    try {
      invariant(params != null, 'Parameter \'params\' is not set');

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
    isRead: boolean, tableName: string, globalSecondaryIndexName: ?string):
    Promise<ConsumedCapacityDesc> {
    try {
      invariant(isRead != null, 'Parameter \'isRead\' is not set');
      invariant(tableName != null, 'Parameter \'tableName\' is not set');

      // These values determine how many minutes worth of metrics
      let statisticCount = 5;
      let statisticSpanMinutes = 1;
      let statisticType = 'Average';

      let EndTime = new Date();
      let StartTime = new Date();
      StartTime.setTime(EndTime - (60000 * statisticSpanMinutes * statisticCount));
      let MetricName = isRead ? 'ConsumedReadCapacityUnits' : 'ConsumedWriteCapacityUnits';
      let Dimensions = this.getDimensions(tableName, globalSecondaryIndexName);
      let params = {
        Namespace: 'AWS/DynamoDB',
        MetricName,
        Dimensions,
        StartTime,
        EndTime,
        Period: (statisticSpanMinutes * 60),
        Statistics: [ statisticType ],
        Unit: 'Count'
      };

      let statistics = await this.cw.getMetricStatisticsAsync(params);
      let value = this.getProjectedValue(statistics);
      let result: ConsumedCapacityDesc = {
        tableName,
        globalSecondaryIndexName,
        value
      };

      return result;
    } catch (ex) {
      warning(JSON.stringify({
        class: 'CapacityCalculator',
        function: 'getConsumedCapacityAsync',
        isRead, tableName, globalSecondaryIndexName,
      }, null, json.padding));
      throw ex;
    }
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
