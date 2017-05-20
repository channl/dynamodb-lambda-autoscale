/* @flow */
import invariant from 'invariant';
import warning from 'warning';
import Instrument from '../logging/Instrument';
import AWS from 'aws-sdk';
import Delay from '../utils/Delay';
import Async from 'async';
import type {
  DynamoDBConfig,
  DescribeTableRequest,
  DescribeTableResponse,
  UpdateTableRequest,
  UpdateTableResponse,
  ListTablesRequest,
  ListTablesResponse,
} from 'aws-sdk';

export default class DynamoDB {
  _db: AWS.DynamoDB;
  _updatePool: Async.QueueObject<UpdateTableRequest, UpdateTableResponse>;

  constructor(dynamoOptions: DynamoDBConfig) {
    invariant(dynamoOptions != null, 'Parameter \'dynamoOptions\' is not set');
    this._db = new AWS.DynamoDB(dynamoOptions);
    this._updatePool = Async.queue(async (params: UpdateTableRequest,
      callback: (result: UpdateTableResponse) => void) => {
      let result = await this.updateTableAndWaitAsync(params, true);
      callback(result);
    }, 10);
  }

  // $FlowIgnore
  @Instrument.timer()
  async listTablesAsync(params: ?ListTablesRequest): Promise<ListTablesResponse> {
    return await this._db.listTables(params).promise();
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

  // $FlowIgnore
  @Instrument.timer()
  async describeTableAsync(params: DescribeTableRequest): Promise<DescribeTableResponse> {
    invariant(params != null, 'Parameter \'params\' is not set');
    return await this._db.describeTable(params).promise();
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
      try {
        invariant(params != null, 'Parameter \'params\' is not set');
        this._updatePool.push(params, resolve);
      } catch (ex) {
        warning(false, JSON.stringify({
          class: 'DynamoDB',
          function: 'updateTableAsync',
          params
        }));
        reject(ex);
      }
    });
  }

  async updateTableAndWaitAsync(params: UpdateTableRequest,
    isRateLimited: boolean): Promise<UpdateTableResponse> {

    let response = await this._db.updateTable(params).promise();
    if (isRateLimited) {
      await this.delayUntilTableIsActiveAsync(params.TableName);
    }

    return response;
  }

  // $FlowIgnore
  @Instrument.timer()
  async updateTableAsync(params: UpdateTableRequest): Promise<UpdateTableResponse> {
    invariant(params != null, 'Parameter \'params\' is not set');
    return await this._db.updateTable(params).promise();
  }
}
