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
    logger.debug('*** LAMBDA START ***');

    let db = new DynamoDB(config.connection.dynamoDB, config.connection.cloudWatch);
    let tables = await db.listTablesAsync();
    let capacityTasks = tables
      .TableNames
      .map(async tableName => {

        logger.debug('Getting table description', tableName);
        let tableDescription = await db.describeTableAsync({TableName: tableName});
        logger.debug(JSON.stringify({tableDescription}));
        logger.debug('Getting table consumed capacity description', tableName);
        let consumedCapacityTableDescription = await db.describeTableConsumedCapacityAsync(tableDescription.Table);
        logger.debug(JSON.stringify({consumedCapacityTableDescription}));

        logger.debug('Getting table update request', tableName);
        let tableUpdateRequest = await config.getTableUpdateAsync(tableDescription, consumedCapacityTableDescription);
        if (tableUpdateRequest) {
          logger.debug('Updating table', tableName);
          logger.debug(JSON.stringify({tableUpdateRequest}));
          await db.updateTableAsync(tableUpdateRequest);
          logger.debug('Updated table', tableName);
        }
      });

    await Promise.all(capacityTasks);

    // Return an empty response
    let response = null;
    if (context) {
      context.succeed(response);
    } else {
      return response;
    }

  } catch (e) {
    logger.crit(e);
    if (context) {
      context.fail(e);
    } else {
      throw e;
    }

  } finally {
    let st = new Stats(stats);
    st.getSummaries().forEach(s => logger.debug('METRIC', s));
    st.reset();
    logger.debug('*** LAMBDA FINISH ***');
  }
};
