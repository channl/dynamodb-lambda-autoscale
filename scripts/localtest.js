/* @flow */
/* eslint-disable */
// $FlowIgnore
import babelPolyfill from 'babel-polyfill';
/* eslint-enable */
import config from '../src/Config';
// $FlowIgnore
import dotenv from 'dotenv';
import DynamoDB from '../src/DynamoDB';
import CloudWatch from '../src/CloudWatch';
import CapacityCalculator from '../src/CapacityCalculator';
import { log } from '../src/Global';

// Load environment variables
dotenv.config({path: 'config.env'});

async function localtestAsync() {
  let tableName = 'Contacts';

  log('Getting table description', tableName);
  let db = new DynamoDB(config.connection.dynamoDB);
  let tableDescription = await db.describeTableAsync({TableName: tableName});

  log('Getting table consumed capacity description', tableName);
  let cw = new CloudWatch(config.connection.cloudWatch);
  let cc = new CapacityCalculator(cw);
  let consumedCapacity = await cc.describeTableConsumedCapacityAsync(tableDescription.Table);

  log(JSON.stringify({
    consumedCapacity
  }, null, 2));
}

localtestAsync();
