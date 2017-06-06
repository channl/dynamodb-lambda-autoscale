/* @flow */
import DynamoDBAutoscaler from '../src/DynamoDBAutoscaler';
import ConsumedThroughputCalculator from '../src/ConsumedThroughputCalculator';
import type { TableDescription, GetMetricStatisticsResponse } from 'aws-sdk';
import type { ProvisionerConfig } from '../src/flow/FlowTypes';

test('DynamoDBAutoscaler', async () => {
  let tableDesc: TableDescription = {
    AttributeDefinitions: [],
    CreationDateTime: 0,
    GlobalSecondaryIndexes: [],
    ItemCount: 0,
    KeySchema: [],
    LatestStreamArn: '',
    LatestStreamLabel: '',
    LocalSecondaryIndexes: [],
    ProvisionedThroughput: {
      LastDecreaseDateTime: '',
      LastIncreaseDateTime: '',
      NumberOfDecreasesToday: 0,
      ReadCapacityUnits: 1,
      WriteCapacityUnits: 1,
    },
    StreamSpecification: {
      StreamEnabled: false,
      StreamViewType: '',
    },
    TableArn: '',
    TableName: 'TestTable',
    TableSizeBytes: 0,
    TableStatus: '',
  };

  let consumedThroughput: GetMetricStatisticsResponse = {
    Datapoints: [],
    Label: '',
    ResponseMetadata: { RequestId: '' },
  };

  let provConfig: ProvisionerConfig = {
    ReadCapacity: {},
    WriteCapacity: {},
  };

  let cc = new ConsumedThroughputCalculator(async () => consumedThroughput);

  let autoscaler = DynamoDBAutoscaler.create({ region: '' }, { region: '' }, provConfig)
    .useTableNamesAsyncFunc(async () => await [tableDesc.TableName])
    .useTableConsumedCapacityAsyncFunc(async td => await cc.describeTableConsumedCapacityAsync(td))
    .useDescribeTableAsyncFunc(async () => await { Table: tableDesc })
    .useUpdateTableAsyncFunc(async () => await { TableDescription: tableDesc });

  expect(autoscaler != null).toEqual(true);

  await autoscaler.runAsync();
});
