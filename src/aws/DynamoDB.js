/* @flow */
import AWS from 'aws-sdk-promise';
import { json, stats, warning, invariant } from '../Global';
import Delay from '../utils/Delay';
import Async from 'async';
import type {
  DynamoDBOptions,
  DescribeTableRequest,
  DescribeTableResponse,
  UpdateTableRequest,
  UpdateTableResponse,
  ListTablesRequest,
  ListTablesResponse,
} from 'aws-sdk-promise';

export default class DynamoDB {
  _db: AWS.DynamoDB;
  _updatePool: Object;

  constructor(dynamoOptions: DynamoDBOptions) {
    invariant(dynamoOptions != null, 'Parameter \'dynamoOptions\' is not set');
    this._db = new AWS.DynamoDB(dynamoOptions);
    this._updatePool = Async.queue(async (params, callback) => {
      let result = await this.updateTableAndWaitAsync(params, true);
      callback(result);
    }, 10);
  }

  static create(region: string): DynamoDB {
    var options = {
      region,
      apiVersion: '2012-08-10',
      dynamoDbCrc32: false,
      httpOptions: { timeout: 5000 }
    };

    return new DynamoDB(options);
  }

  async listTablesAsync(params: ?ListTablesRequest): Promise<ListTablesResponse> {
    let sw = stats.timer('DynamoDB.listTablesAsync').start();
    try {
      let res = await this._db.listTables(params).promise();
      return res.data;
    } catch (ex) {
      warning(JSON.stringify({
        class: 'DynamoDB',
        function: 'listTablesAsync'
      }, null, json.padding));
      throw ex;
    } finally {
      sw.end();
    }
  }

  async listAllTableNamesAsync(): Promise<string[]> {
    let tableNames = [];
    let lastTable;
    do {
      let listTablesResponse = await this.listTablesAsync({ ExclusiveStartTableName: lastTable });
      tableNames = tableNames.concat(listTablesResponse.TableNames);
      lastTable = listTablesResponse.LastEvaluatedTableName;
    } while (lastTable);
    return tableNames;
  }

  async describeTableAsync(params: DescribeTableRequest): Promise<DescribeTableResponse> {
    let sw = stats.timer('DynamoDB.describeTableAsync').start();
    try {
      invariant(params != null, 'Parameter \'params\' is not set');
      let res = await this._db.describeTable(params).promise();
      return res.data;
    } catch (ex) {
      warning(JSON.stringify({
        class: 'DynamoDB',
        function: 'describeTableAsync',
        params
      }, null, json.padding));
      throw ex;
    } finally {
      sw.end();
    }
  }

  async delayUntilTableIsActiveAsync(tableName: string): Promise<void> {
    let isActive = false;
    let attempt = 0;
    do {
      let result = await this.describeTableAsync({ TableName: tableName });
      isActive = result.Table.TableStatus === 'ACTIVE';
      if (!isActive) {
        await Delay.delayAsync(1000);
        attempt++;
      }
    } while (!isActive && attempt < 10);
  }

  updateTableWithRateLimitAsync(params: UpdateTableRequest,
    isRateLimited: boolean): Promise<UpdateTableResponse> {

    if (!isRateLimited) {
      return this.updateTableAndWaitAsync(params, isRateLimited);
    }

    return new Promise((resolve, reject) => {
      let sw = stats.timer('DynamoDB.updateTableAsync').start();
      try {
        invariant(params != null, 'Parameter \'params\' is not set');
        this._updatePool.push(params, resolve);
      } catch (ex) {
        warning(JSON.stringify({
          class: 'DynamoDB',
          function: 'updateTableAsync',
          params
        }, null, json.padding));
        reject(ex);
      } finally {
        sw.end();
      }
    });
  }

  async updateTableAndWaitAsync(params: UpdateTableRequest,
    isRateLimited: boolean): Promise<UpdateTableResponse> {

    let response = await this._db.updateTable(params).promise();
    if (isRateLimited) {
      await this.delayUntilTableIsActiveAsync(params.TableName);
    }

    return response.data;
  }

  async updateTableAsync(params: UpdateTableRequest): Promise<UpdateTableResponse> {
    let sw = stats.timer('DynamoDB.updateTableAsync').start();
    try {
      invariant(params != null, 'Parameter \'params\' is not set');
      let res = await this._db.updateTable(params).promise();
      return res.data;
    } catch (ex) {
      warning(JSON.stringify({
        class: 'DynamoDB',
        function: 'updateTableAsync',
        params
      }, null, json.padding));
      throw ex;
    } finally {
      sw.end();
    }
  }
}
