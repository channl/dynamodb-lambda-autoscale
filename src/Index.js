import babelPolyfill  // eslint-disable-line no-unused-vars
  from 'babel-polyfill';
import config from './Config';
import dotenv from 'dotenv';
import DynamoDB from './DynamoDB';
import Stats from './Stats';
import Global from './Global';
const {
  stats,
  logger
} = Global;

logger.info('*** LAMBDA INIT ***');
export let handler = async (event, context) => {
  try {
    logger.info('*** LAMBDA START ***');

    // Load environment variables
    dotenv.load();

    let db = new DynamoDB(
      config.connection.dynamoDB,
      config.connection.cloudWatch);

    let tables = await db.listTablesAsync();
    let capacityTasks = tables
      .TableNames
      .map(async tableName => {

        logger.info('Getting table description', tableName);
        let tableDescription = await db.describeTableAsync(
          {TableName: tableName});

        logger.info('Getting table consumed capacity description', tableName);
        let consumedCapacityTableDescription = await db
          .describeTableConsumedCapacityAsync(tableDescription.Table, 1);

        logger.info('Getting table update request', tableName);
        let tableUpdateRequest = config.getTableUpdate(tableDescription,
          consumedCapacityTableDescription);

        if (tableUpdateRequest) {
          logger.info('Updating table', tableName);
          await db.updateTableAsync(tableUpdateRequest);
          logger.info('Updated table', tableName);
        }

        // Log the monthlyEstimatedCost
        let totalTableProvisionedThroughput = db
          .getTotalTableProvisionedThroughput(tableDescription);

        let monthlyEstimatedCost = db
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

    // Log stats
    let st = new Stats(stats);
    logger.info(JSON.stringify(st.toJSON()));
    st.reset();

    // Log readable info
    let updateRequests = capacityItems
      .map(i => i.tableUpdateRequest)
      .filter(i => i !== null);

    logger.info(updateRequests.length + ' table updates');
    updateRequests.forEach(i => logger.debug(JSON.stringify(i, null, 2)));

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

    logger.info(
      JSON.stringify({TotalProvisionedThroughput: totalProvisionedThroughput}));

    logger.info(
      JSON.stringify({TotalMonthlyEstimatedCost: totalMonthlyEstimatedCost}));

    // Return an empty response
    let response = null;
    if (context) {
      context.succeed(response);
    } else {
      return response;
    }

  } catch (e) {
    logger.error(e);
    if (context) {
      context.fail(e);
    } else {
      throw e;
    }

  } finally {
    logger.info('*** LAMBDA FINISH ***');
  }
};
