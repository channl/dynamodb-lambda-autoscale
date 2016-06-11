/* @flow */
/* eslint-disable */
// $FlowIgnore
import babelPolyfill from 'babel-polyfill';
/* eslint-enable */
import config from './Config';
// $FlowIgnore
import dotenv from 'dotenv';
import DynamoDB from './DynamoDB';
import CloudWatch from './CloudWatch';
import Stats from './Stats';
import CostEstimation from './CostEstimation';
import Throughput from './Throughput';
import CapacityCalculator from './CapacityCalculator';
import { json, stats, log, invariant } from '../src/Global';

log('*** LAMBDA INIT ***');
export let handler = async (event: any, context: any) => {
  try {
    log('*** LAMBDA START ***');
    let sw = stats.timer('Index.handler').start();

    // In local mode the json padding can be overridden
    if (event.json && event.json.padding) {
      json.padding = event.json.padding;
    }

    // Load environment variables
    dotenv.config({path: 'config.env'});

    let db = new DynamoDB(config.connection.dynamoDB);
    let cw = new CloudWatch(config.connection.cloudWatch);
    let cc = new CapacityCalculator(cw);

    log('Getting table names');
    let tableNames = await config.getTableNamesAsync(db);
    let capacityTasks = tableNames
      .map(async tableName => {

        log('Getting table description', tableName);
        let describeTableResponse = await db.describeTableAsync({TableName: tableName});
        let tableDescription = describeTableResponse.Table;

        log('Getting table consumed capacity description', tableName);
        let consumedCapacityTableDescription = await cc
          .describeTableConsumedCapacityAsync(tableDescription, 1);

        log('Getting table update request', tableName);
        let tableUpdateRequest = config.getTableUpdate(tableDescription,
          consumedCapacityTableDescription);

        if (tableUpdateRequest) {
          log('Updating table', tableName);
          await db.updateTableAsync(tableUpdateRequest);
          log('Updated table', tableName);
        }

        // Log the monthlyEstimatedCost
        let totalTableProvisionedThroughput = Throughput
          .getTotalTableProvisionedThroughput(tableDescription);

        let monthlyEstimatedCost = CostEstimation
          .getMonthlyEstimatedTableCost(totalTableProvisionedThroughput);

        stats
          .counter('DynamoDB.monthlyEstimatedCost')
          .inc(monthlyEstimatedCost);

        return {
          tableDescription,
          consumedCapacityTableDescription,
          tableUpdateRequest,
          totalTableProvisionedThroughput,
          monthlyEstimatedCost
        };
      });

    let capacityItems = await Promise.all(capacityTasks);
    sw.end();

    // Log stats
    let st = new Stats(stats);
    let stJSON = st.toJSON();
    st.reset();

    // Log readable info
    let updateRequests = capacityItems
      .map(i => i.tableUpdateRequest)
      .filter(i => i !== null);

    let totalMonthlyEstimatedCost = capacityItems
      .reduce((prev, curr) => prev + curr.monthlyEstimatedCost, 0);

    let totalProvisionedThroughput = capacityItems.reduce((prev, curr) => {
      return {
        ReadCapacityUnits: prev.ReadCapacityUnits +
          curr.totalTableProvisionedThroughput.ReadCapacityUnits,
        WriteCapacityUnits: prev.WriteCapacityUnits +
          curr.totalTableProvisionedThroughput.WriteCapacityUnits,
      };
    }, {ReadCapacityUnits: 0, WriteCapacityUnits: 0});

    log(JSON.stringify({
      'Index.handler': {
        mean: stJSON['Index.handler'].histogram.mean
      },
      'DynamoDB.listTablesAsync': {
        mean: stJSON['DynamoDB.listTablesAsync'].histogram.mean,
      },
      'DynamoDB.describeTableAsync': {
        mean: stJSON['DynamoDB.describeTableAsync'].histogram.mean,
      },
      'DynamoDB.describeTableConsumedCapacityAsync': {
        mean: stJSON['DynamoDB.describeTableConsumedCapacityAsync']
          .histogram.mean,
      },
      'CloudWatch.getMetricStatisticsAsync': {
        mean: stJSON['CloudWatch.getMetricStatisticsAsync'].histogram.mean,
      },
      TableUpdates: {
        count: updateRequests.length,
      },
      TotalProvisionedThroughput: totalProvisionedThroughput,
      TotalMonthlyEstimatedCost: totalMonthlyEstimatedCost,
    }, null, json.padding));

    // Return an empty response
    let response = null;
    if (context) {
      context.succeed(response);
    } else {
      return response;
    }

  } catch (e) {
    invariant(e);
    if (context) {
      context.fail(e);
    } else {
      throw e;
    }

  } finally {
    log('*** LAMBDA FINISH ***');
  }
};
