/* @flow */
/* eslint-disable */
// $FlowIgnore
import babelPolyfill from 'babel-polyfill';
/* eslint-enable */
// $FlowIgnore
import dotenv from 'dotenv';
import App from './App';
import { log } from './Global';

log('*** LAMBDA INIT ***');
export let handler = async (event: any, context: any) => {
  try {
    dotenv.config({path: 'config.env'});

    let app = new App();
    log('*** LAMBDA START ***');
    await app.runAsync(event, context);
  } catch (e) {
    log('*** LAMBDA ERROR ***');
    if (context) {
      context.fail(e);
    } else {
      throw e;
    }
  } finally {
    log('*** LAMBDA FINISH ***');
  }
};
