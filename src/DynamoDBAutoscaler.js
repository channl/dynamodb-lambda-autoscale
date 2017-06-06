/* @flow */
import Instrument from './logging/Instrument';
import log from './logging/log';
import invariant from 'invariant';
import CostEstimation from './utils/CostEstimation';
import ThroughputUtils from './utils/ThroughputUtils';
import RateLimitedTableUpdater from './utils/RateLimitedTableUpdater';
import ConsumedThroughputCalculator from './ConsumedThroughputCalculator';
import ProvisionedThroughtputCalculator from './ProvisionedThroughtputCalculator';
import DynamoDB from './aws/DynamoDB';
import CloudWatch from './aws/CloudWatch';
import type {
  DynamoDBConfig,
  CloudWatchOptions,
  UpdateTableRequest,
  UpdateTableResponse,
  DescribeTableRequest,
  DescribeTableResponse,
} from 'aws-sdk';
import type { GetTableConsumedCapacityAsyncFunc, GetTableUpdateAsyncFunc, ProvisionerConfig } from './flow/FlowTypes';

export default class DynamoDBAutoscaler {
  _getTableNamesAsyncFunc: () => Promise<string[]>;
  _getTableConsumedCapacityAsyncFunc: GetTableConsumedCapacityAsyncFunc;
  _getTableUpdateAsyncFunc: GetTableUpdateAsyncFunc;
  _describeTableAsync: (params: DescribeTableRequest) => Promise<DescribeTableResponse>;
  _updateTableAsync: (params: UpdateTableRequest) => Promise<UpdateTableResponse>;
  _rateLimitedTableUpdater: RateLimitedTableUpdater;

  constructor(
    getTableNamesAsyncFunc: () => Promise<string[]>,
    getTableConsumedCapacityAsyncFunc: GetTableConsumedCapacityAsyncFunc,
    getTableUpdateAsyncFunc: GetTableUpdateAsyncFunc,
    describeTableAsync: (params: DescribeTableRequest) => Promise<DescribeTableResponse>,
    updateTableAsync: (params: UpdateTableRequest) => Promise<UpdateTableResponse>
  ) {
    this._getTableNamesAsyncFunc = getTableNamesAsyncFunc;
    this._getTableConsumedCapacityAsyncFunc = getTableConsumedCapacityAsyncFunc;
    this._getTableUpdateAsyncFunc = getTableUpdateAsyncFunc;
    this._describeTableAsync = describeTableAsync;
    this._updateTableAsync = updateTableAsync;
    this._rateLimitedTableUpdater = new RateLimitedTableUpdater(describeTableAsync, updateTableAsync);
  }

  static create(
    dbConfig: DynamoDBConfig,
    cwConfig: CloudWatchOptions,
    provConfig: ProvisionerConfig
  ): DynamoDBAutoscaler {
    let db = new DynamoDB(dbConfig);
    let cw = new CloudWatch(cwConfig);
    let ctc = new ConsumedThroughputCalculator(cw.getMetricStatisticsAsync);
    let ptc = new ProvisionedThroughtputCalculator();
    return new DynamoDBAutoscaler(
      db.listAllTableNamesAsync,
      ctc.describeTableConsumedCapacityAsync,
      (td, tcc) => ptc.getTableUpdateAsync(td, tcc, provConfig),
      db.describeTableAsync,
      db.updateTableAsync
    );
  }

  useTableNamesAsyncFunc(func: () => Promise<string[]>): DynamoDBAutoscaler {
    return new DynamoDBAutoscaler(
      func,
      this._getTableConsumedCapacityAsyncFunc,
      this._getTableUpdateAsyncFunc,
      this._describeTableAsync,
      this._updateTableAsync
    );
  }

  useTableConsumedCapacityAsyncFunc(func: GetTableConsumedCapacityAsyncFunc): DynamoDBAutoscaler {
    return new DynamoDBAutoscaler(
      this._getTableNamesAsyncFunc,
      func,
      this._getTableUpdateAsyncFunc,
      this._describeTableAsync,
      this._updateTableAsync
    );
  }

  useTableUpdateAsyncFunc(func: GetTableUpdateAsyncFunc): DynamoDBAutoscaler {
    return new DynamoDBAutoscaler(
      this._getTableNamesAsyncFunc,
      this._getTableConsumedCapacityAsyncFunc,
      func,
      this._describeTableAsync,
      this._updateTableAsync
    );
  }

  useDescribeTableAsyncFunc(
    func: (params: DescribeTableRequest) => Promise<DescribeTableResponse>
  ): DynamoDBAutoscaler {
    return new DynamoDBAutoscaler(
      this._getTableNamesAsyncFunc,
      this._getTableConsumedCapacityAsyncFunc,
      this._getTableUpdateAsyncFunc,
      func,
      this._updateTableAsync
    );
  }

  useUpdateTableAsyncFunc(func: (params: UpdateTableRequest) => Promise<UpdateTableResponse>): DynamoDBAutoscaler {
    return new DynamoDBAutoscaler(
      this._getTableNamesAsyncFunc,
      this._getTableConsumedCapacityAsyncFunc,
      this._getTableUpdateAsyncFunc,
      this._describeTableAsync,
      func
    );
  }

  // $FlowIgnore
  @Instrument.timer()
  async runAsync(): Promise<void> {
    log('Getting names of tables to autoscale');
    let tableNames = await this._getTableNamesAsyncFunc();

    log(`Getting details of ${tableNames.length} tables`);
    let tableDetails = await Promise.all(
      tableNames.map(async tableName => {
        log(`Getting '${tableName}' table description`);
        let tableDescriptionResp = await this._describeTableAsync({ TableName: tableName });
        let tableDescription = tableDescriptionResp.Table;

        log(`Getting '${tableName}' table consumed capacity description`);
        let consumedCapacityTableDescription = await this._getTableConsumedCapacityAsyncFunc(tableDescription);

        log(`Getting '${tableName}' table update request`);
        let tableUpdateRequest = await this._getTableUpdateAsyncFunc(
          tableDescription,
          consumedCapacityTableDescription
        );

        log(`Getting '${tableName}' table provisioned throughput`);
        let totalTableProvisionedThroughput = ThroughputUtils.getTotalTableProvisionedThroughput(tableDescription);

        log(`Getting '${tableName}' table estimated cost`);
        let monthlyEstimatedCost = CostEstimation.getMonthlyEstimatedTableCost(totalTableProvisionedThroughput);

        return {
          tableName,
          tableDescription,
          consumedCapacityTableDescription,
          tableUpdateRequest,
          totalTableProvisionedThroughput,
          monthlyEstimatedCost,
        };
      })
    );

    let tableUpdateRequests = this._filterNulls(tableDetails.map(td => td.tableUpdateRequest));
    if (tableUpdateRequests.length === 0) {
      log('No table updates required');
      return;
    }

    log('Updating tables');
    await this._updateTablesAsync(tableUpdateRequests);
    log('Updated tables');
  }

  async _updateTablesAsync(tableUpdateRequests: UpdateTableRequest[]): Promise<void> {
    invariant(Array.isArray(tableUpdateRequests), 'The argument tableUpdateRequests was not an array');

    // If we are updating more than 10 tables in a single run
    // then we must wait until each one has been completed to
    // ensure we do not hit the AWS limit of 10 concurrent updates
    let isRateLimitedUpdatingRequired = tableUpdateRequests.length > 10;
    await Promise.all(
      tableUpdateRequests.map(async req => this._updateTableInternalAsync(req, isRateLimitedUpdatingRequired))
    );
  }

  async _updateTableInternalAsync(
    tableUpdateRequest: UpdateTableRequest,
    isRateLimitedUpdatingRequired: boolean
  ): Promise<void> {
    invariant(tableUpdateRequest != null, 'The argument tableUpdateRequest was null');
    invariant(
      typeof isRateLimitedUpdatingRequired === 'boolean',
      'The argument isRateLimitedUpdatingRequired was not a boolean'
    );

    log(`Updating table '${tableUpdateRequest.TableName}'`);
    if (isRateLimitedUpdatingRequired) {
      await this._rateLimitedTableUpdater.updateTableAsync(tableUpdateRequest);
    } else {
      await this._updateTableAsync(tableUpdateRequest);
    }
    log(`Updated table '${tableUpdateRequest.TableName}'`);
  }
  /*
  _logMetrics(tableDetails: Object[]) {
    invariant(Array.isArray(tableDetails), 'The argument \'tableDetails\' was not an array');

    // Log stats
    let st = new Stats(stats);
    let stJSON = st.toJSON();
    st.reset();

    // Log readable info
    let updateRequests = tableDetails.map(i => i.tableUpdateRequest).filter(i => i !== null);
    let totalMonthlyEstimatedCost = tableDetails
      .reduce((prev, curr) => prev + curr.monthlyEstimatedCost, 0);
    let totalProvisionedThroughput = tableDetails.reduce((prev, curr) => {
      return {
        ReadCapacityUnits: prev.ReadCapacityUnits +
          curr.totalTableProvisionedThroughput.ReadCapacityUnits,
        WriteCapacityUnits: prev.WriteCapacityUnits +
          curr.totalTableProvisionedThroughput.WriteCapacityUnits,
      };
    }, {ReadCapacityUnits: 0, WriteCapacityUnits: 0});

    let indexHandler = stJSON['Index.handler'] != null ? {
      mean: stJSON['Index.handler'].histogram.mean
    } : undefined;

    let dynamoDBListTablesAsync = stJSON['DynamoDB.listTablesAsync'] != null ? {
      mean: stJSON['DynamoDB.listTablesAsync'].histogram.mean,
    } : undefined;

    let dynamoDBDescribeTableAsync = stJSON['DynamoDB.describeTableAsync'] != null ? {
      mean: stJSON['DynamoDB.describeTableAsync'].histogram.mean,
    } : undefined;

    let dynamoDBDescribeTableConsumedCapacityAsync =
      stJSON['DynamoDB.describeTableConsumedCapacityAsync'] != null ?
        { mean: stJSON['DynamoDB.describeTableConsumedCapacityAsync'].histogram.mean } :
        undefined;

    let cloudWatchGetMetricStatisticsAsync =
      stJSON['CloudWatch.getMetricStatisticsAsync'] != null ?
        { mean: stJSON['CloudWatch.getMetricStatisticsAsync'].histogram.mean } :
        undefined;

    let tableUpdates = updateRequests != null ? { count: updateRequests.length } :
      undefined;

    log(JSON.stringify({
      'Index.handler': indexHandler,
      'DynamoDB.listTablesAsync': dynamoDBListTablesAsync,
      'DynamoDB.describeTableAsync': dynamoDBDescribeTableAsync,
      'DynamoDB.describeTableConsumedCapacityAsync': dynamoDBDescribeTableConsumedCapacityAsync,
      'CloudWatch.getMetricStatisticsAsync': cloudWatchGetMetricStatisticsAsync,
      TableUpdates: tableUpdates,
      TotalProvisionedThroughput: totalProvisionedThroughput,
      TotalMonthlyEstimatedCost: totalMonthlyEstimatedCost,
    }));
  }
  */

  _filterNulls<T>(items: Array<?T>): Array<T> {
    invariant(Array.isArray(items), 'The argument items was not an array');
    let nonNullItems = items.filter(item => item != null);
    return ((nonNullItems: any[]): T[]);
  }
}
