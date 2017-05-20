/* @flow */
import { it, expect } from 'jest';
import DynamoDBAutoscaler from '../src/DynamoDBAutoscaler';
import ConsumedThroughputCalculator from '../src/ConsumedThroughputCalculator';
import ProvisionedThroughtputCalculator from '../src/ProvisionedThroughtputCalculator';
import type { TableDescription, GetMetricStatisticsRequest, GetMetricStatisticsResponse,
  DescribeTableRequest, UpdateTableRequest } from 'aws-sdk';
import type { TableConsumedCapacityDescription, ProvisionerConfig } from '../src/flow/FlowTypes';

it('DynamoDBAutoscaler', async () => {

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
    TableStatus: ''
  };

  let consumedThroughput: GetMetricStatisticsResponse = {
    Datapoints: [],
    Label: '',
    ResponseMetadata: { RequestId: '' },
  };

  let provisionerConfig: ProvisionerConfig = {
    ReadCapacity: {
    },
    WriteCapacity: {
    },
  };

  // eslint-disable-next-line
  let cc = new ConsumedThroughputCalculator(async (params: GetMetricStatisticsRequest) => {
    return consumedThroughput;
  });

  let pr = new ProvisionedThroughtputCalculator();

  let getTableNamesAsyncFunc = async () => {
    return [ tableDesc.TableName ];
  };

  let getTableConsumedCapacityAsyncFunc = async (tableDescription: TableDescription) => {
    return await cc.describeTableConsumedCapacityAsync(tableDescription);
  };

  // eslint-disable-next-line
  let getTableUpdateAsyncFunc = async (tableDescription: TableDescription, tableConsumedCapacityDescription: TableConsumedCapacityDescription) => {
    return await pr.getTableUpdateAsync(tableDescription, tableConsumedCapacityDescription, provisionerConfig);
  };

  // eslint-disable-next-line
  let describeTableAsync = async (params: DescribeTableRequest) => {
    return { Table: tableDesc };
  };

  // eslint-disable-next-line
  let updateTableAsync = async (params: UpdateTableRequest) => {
    return { TableDescription: tableDesc };
  };

  let autoscaler = new DynamoDBAutoscaler(
      getTableNamesAsyncFunc,
      getTableConsumedCapacityAsyncFunc,
      getTableUpdateAsyncFunc,
      describeTableAsync,
      updateTableAsync);

  expect(autoscaler != null).toEqual(true);
});
