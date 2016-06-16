/* @flow */
import DynamoDB from './DynamoDB';
import type {
  TableDescription,
  UpdateTableRequest,
  DynamoDBOptions,
  CloudWatchOptions,
  ProvisionedThroughput,
  Throughput,
} from 'aws-sdk-promise';

export type Config = {
  connection: ConfigConnection,
  getTableNamesAsync: (db: DynamoDB) => Promise<string[]>,
  getTableUpdate: (
    description: TableDescription,
    consumedCapacityDescription: TableConsumedCapacityDescription) => ?UpdateTableRequest
};

export type ConfigurableProvisionerConfig = {
  readCapacity: CapacityConfig,
  writeCapacity: CapacityConfig,
};

export type CapacityConfig = {
  increment: CapacityConfigFuncs,
  decrement: CapacityConfigFuncs,
};

export type CapacityConfigFuncs = {
  isAdjustmentRequired: (data: TableProvisionedAndConsumedThroughput, calcFunc: any) => boolean,
  calculateValue: (data: TableProvisionedAndConsumedThroughput) => number,
};

export type ConfigConnection = {
  dynamoDB: DynamoDBOptions,
  cloudWatch: CloudWatchOptions,
};

export type TableProvisionedAndConsumedThroughput = {
  TableName: string,
  IndexName?: string,
  ProvisionedThroughput: ProvisionedThroughput,
  ConsumedThroughput: Throughput,
};

export type GlobalSecondaryIndexConsumedThroughput = {
  IndexName: string,
  ConsumedThroughput: Throughput,
};

export type TableConsumedCapacityDescription = {
  TableName: string,
  ConsumedThroughput: Throughput,
  GlobalSecondaryIndexes: GlobalSecondaryIndexConsumedThroughput[],
};
