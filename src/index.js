import babelPolyfill from 'babel-polyfill';
import config from './config';
import DynamoDB from './DynamoDB';
import Stats from './Stats';
import Global from './global';
const {
  stats,
  logger
} = Global;

export let handler = async (event, context) => {
  try {
    logger.info('*** LAMBDA START ***');

    let db = new DynamoDB(config.connection.dynamoDB, config.connection.cloudWatch);
    let tables = await db.listTablesAsync();
    let capacityTasks = tables
      .TableNames
      .map(async tableName => {

        logger.info('Getting table description', tableName);
        let tableDescription = await db.describeTableAsync({TableName: tableName});
        logger.info(JSON.stringify({tableDescription}));

        // Log the monthlyEstimatedCost
        let totalTableProvisionedThroughput = db.getTotalTableProvisionedThroughput(tableDescription);
        let monthlyEstimatedCost = db.getMonthlyEstimatedTableCost(totalTableProvisionedThroughput);
        stats.counter('DynamoDB.monthlyEstimatedCost').inc(monthlyEstimatedCost);

        logger.info('Getting table consumed capacity description', tableName);
        let consumedCapacityTableDescription = await db.describeTableConsumedCapacityAsync(tableDescription.Table, 1);
        logger.info(JSON.stringify({consumedCapacityTableDescription}));

        logger.info('Getting table update request', tableName);
        let tableUpdateRequest = config.getTableUpdate(tableDescription, consumedCapacityTableDescription);
        if (tableUpdateRequest) {
          logger.info('Updating table', tableName);
          logger.info(JSON.stringify({tableUpdateRequest}));
          await db.updateTableAsync(tableUpdateRequest);
          logger.info('Updated table', tableName);
        }
      });

    await Promise.all(capacityTasks);

    // Log stats
    let st = new Stats(stats);
    logger.info(JSON.stringify(st.toJSON()));
    st.reset();

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
