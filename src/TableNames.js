/* @flow */
import DynamoDB from './aws/DynamoDB';
import type { GetTableNamesAsyncFunc } from './flow/FlowTypes';

export default class TableNames {

  // Gets the list of tables which we want to autoscale
  static getAllFunc(db: DynamoDB): GetTableNamesAsyncFunc {
    return db.listAllTableNamesAsync;
  }

  static getFixedFunc(tableNames: string[]): GetTableNamesAsyncFunc {
    return async () => tableNames;
  }
}
