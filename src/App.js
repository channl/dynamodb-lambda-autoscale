/* @flow */
import Provisioner from './Provisioner';
import Stats from './utils/Stats';
import CostEstimation from './utils/CostEstimation';
import Throughput from './utils/Throughput';
import CapacityCalculator from './CapacityCalculator';
import { json, stats, log, invariant } from './Global';
import type { UpdateTableRequest } from 'aws-sdk';

export default class App {
  _provisioner: Provisioner;
  _capacityCalculator: CapacityCalculator;

  constructor() {
    this._provisioner = new Provisioner();
    this._capacityCalculator = new CapacityCalculator();
  }

  async runAsync(event: any, context: any): Promise<void> {
    invariant(event != null, 'The argument \'event\' was null');
    invariant(context != null, 'The argument \'context\' was null');

    let sw = stats.timer('Index.handler').start();

    // In local mode the json padding can be overridden
    if (event.json && event.json.padding) {
      json.padding = event.json.padding;
    }

    log('Getting table names');
    let tableNames = await this._provisioner.getTableNamesAsync();

    log('Getting table details');
    let tableDetails = await this._getTableDetailsAsync(tableNames);

    log('Getting required table update requests');
    let tableUpdateRequests = this._getTableUpdateRequests(tableDetails);

    if (tableUpdateRequests.length > 0) {
      log('Updating tables');
      await this._updateTablesAsync(tableUpdateRequests);
      log('Updated tables');
    } else {
      log('No table updates required');
    }

    sw.end();
    this._logMetrics(tableDetails);

    // Return an empty response
    if (context) {
      context.succeed(null);
    }
  }

  async _getTableDetailsAsync(tableNames: string[]): Promise<Object[]> {
    invariant(tableNames instanceof Array, 'The argument \'tableNames\' was not an array');

    let tasks = tableNames.map(name => this._getTableDetailAsync(name));
    return await Promise.all(tasks);
  }

  async _getTableDetailAsync(tableName: string): Promise<Object> {
    invariant(typeof tableName === 'string', 'The argument \'tableName\' was not a string');

    log('Getting table description', tableName);
    let describeTableResponse = await this._provisioner.db
      .describeTableAsync({TableName: tableName});

    let tableDescription = describeTableResponse.Table;

    log('Getting table consumed capacity description', tableName);
    let consumedCapacityTableDescription = await this._capacityCalculator
      .describeTableConsumedCapacityAsync(tableDescription);

    log('Getting table update request', tableName);
    let tableUpdateRequest = await this._provisioner.getTableUpdateAsync(tableDescription,
      consumedCapacityTableDescription);

    // Log the monthlyEstimatedCost
    let totalTableProvisionedThroughput = Throughput
      .getTotalTableProvisionedThroughput(tableDescription);

    let monthlyEstimatedCost = CostEstimation
      .getMonthlyEstimatedTableCost(totalTableProvisionedThroughput);

    stats
      .counter('DynamoDB.monthlyEstimatedCost')
      .inc(monthlyEstimatedCost);

    let result = {
      tableName,
      tableDescription,
      consumedCapacityTableDescription,
      tableUpdateRequest,
      totalTableProvisionedThroughput,
      monthlyEstimatedCost,
    };

    return result;
  }

  async _updateTablesAsync(tableUpdateRequests: UpdateTableRequest[]): Promise<void> {
    invariant(tableUpdateRequests instanceof Array,
      'The argument \'tableUpdateRequests\' was not an array');

    // If we are updating more than 10 tables in a single run
    // then we must wait until each one has been completed to
    // ensure we do not hit the AWS limit of 10 concurrent updates
    let isRateLimitedUpdatingRequired = tableUpdateRequests.length > 10;
    await Promise.all(tableUpdateRequests.map(
      async req => this._updateTableAsync(req, isRateLimitedUpdatingRequired)
    ));
  }

  async _updateTableAsync(tableUpdateRequest: UpdateTableRequest,
    isRateLimitedUpdatingRequired: boolean): Promise<void> {
    invariant(tableUpdateRequest != null, 'The argument \'tableUpdateRequest\' was null');
    invariant(typeof isRateLimitedUpdatingRequired === 'boolean',
      'The argument \'isRateLimitedUpdatingRequired\' was not a boolean');

    log('Updating table', tableUpdateRequest.TableName);
    await this._provisioner.db
      .updateTableWithRateLimitAsync(tableUpdateRequest, isRateLimitedUpdatingRequired);

    log('Updated table', tableUpdateRequest.TableName);
  }

  _getTableUpdateRequests(tableDetails: Object[]): UpdateTableRequest[] {
    invariant(tableDetails instanceof Array,
      'The argument \'tableDetails\' was not an array');

    return tableDetails
      .filter(({tableUpdateRequest}) => { return tableUpdateRequest != null; })
      .map(({tableUpdateRequest}) => tableUpdateRequest);
  }

  _logMetrics(tableDetails: Object[]) {
    invariant(tableDetails instanceof Array,
      'The argument \'tableDetails\' was not an array');

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
    }, null, json.padding));
  }
}
