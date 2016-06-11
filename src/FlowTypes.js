/* @flow */
import DynamoDB from './DynamoDB';

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

export type CloudWatchOptions = {
  apiVersion: string,
  region: string,
  httpOptions: HTTPOptions,
};

export type DynamoDBOptions = {
  apiVersion: string,
  region: string,
  dynamoDbCrc32: boolean,
  httpOptions: HTTPOptions,
};

export type HTTPOptions = {
  timeout: number,
};

export type AttributeDefinition = {
  AttributeName: string,
  AttributeType: string,
};

export type KeyDefinition = {
  AttributeName: string,
  KeyType: string,
};

export type Projection = {
  NonKeyAttributes: string[],
  ProjectionType: string,
};

export type ProvisionedThroughput = {
   LastDecreaseDateTime: number,
   LastIncreaseDateTime: number,
   NumberOfDecreasesToday: number,
   ReadCapacityUnits: number,
   WriteCapacityUnits: number,
};

export type Throughput = {
  ReadCapacityUnits: number,
  WriteCapacityUnits: number,
};

export type GlobalSecondaryIndex = {
  Backfilling: boolean,
  IndexArn: string,
  IndexName: string,
  IndexSizeBytes: number,
  IndexStatus: string,
  ItemCount: number,
  KeySchema: KeyDefinition[],
  Projection: Projection,
  ProvisionedThroughput: ProvisionedThroughput,
};

export type LocalSecondaryIndex = {
   IndexArn: string,
   IndexName: string,
   IndexSizeBytes: number,
   ItemCount: number,
   KeySchema: KeyDefinition[],
   Projection: Projection,
};

export type StreamSpecification = {
   StreamEnabled: boolean,
   StreamViewType: string,
};

export type TableDescription = {
  AttributeDefinitions: AttributeDefinition[],
  CreationDateTime: number,
  GlobalSecondaryIndexes: GlobalSecondaryIndex[],
  ItemCount: number,
  KeySchema: KeyDefinition[],
  LatestStreamArn: string,
  LatestStreamLabel: string,
  LocalSecondaryIndexes: LocalSecondaryIndex[],
  ProvisionedThroughput: ProvisionedThroughput,
  StreamSpecification: StreamSpecification,
  TableArn: string,
  TableName: string,
  TableSizeBytes: number,
  TableStatus: string
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

export type DescribeTableRequest = {
   TableName: string,
};

export type DescribeTableResponse = {
  Table: TableDescription,
};

export type ResponseMetadata = {
  RequestId: string,
}

export type Datapoint = {
  Timestamp: string,
  Average: number,
  Unit: string,
};

export type GetMetricStatisticsResponse = {
  ResponseMetadata: ResponseMetadata,
  Label: string,
  Datapoints: Datapoint[],
};

export type Dimension = {
  Name: string,
  Value: string,
};

export type GetMetricStatisticsRequest = {
  Namespace: string,
  MetricName: string,
  Dimensions: Dimension[],
  StartTime: Date,
  EndTime: Date,
  Period: number,
  Statistics: string[],
  Unit: string,
};

export type GlobalSecondaryIndexUpdateCreate = {
  IndexName: string,
  KeySchema: KeyDefinition[],
  Projection: Projection,
  ProvisionedThroughput: Throughput,
};

export type GlobalSecondaryIndexUpdateDelete = {
  IndexName: string,
};

export type GlobalSecondaryIndexUpdateUpdate = {
  IndexName: string,
  ProvisionedThroughput: Throughput,
};

export type GlobalSecondaryIndexUpdate = {
   Create?: GlobalSecondaryIndexUpdateCreate,
   Delete?: GlobalSecondaryIndexUpdateDelete,
   Update?: GlobalSecondaryIndexUpdateUpdate,
};

export type UpdateTableRequest = {
   AttributeDefinitions?: AttributeDefinition[],
   GlobalSecondaryIndexUpdates? : GlobalSecondaryIndexUpdate[],
   ProvisionedThroughput?: Throughput,
   StreamSpecification?: StreamSpecification,
   TableName: string
};

export type TableProvisionedAndConsumedThroughput = {
  TableName: string,
  IndexName?: string,
  ProvisionedThroughput: ProvisionedThroughput,
  ConsumedThroughput: Throughput,
};

export type UpdateTableResponse = {
  TableDescription: TableDescription,
};

export type ListTablesRequest = {
   ExclusiveStartTableName?: string,
   Limit?: number
};

export type ListTablesResponse = {
   LastEvaluatedTableName?: string,
   TableNames: string[]
};
