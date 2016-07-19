/* @flow */
import AWS from 'aws-sdk-promise';
import { json, stats, warning, invariant } from '../Global';
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

  constructor(dynamoOptions: DynamoDBOptions) {
    invariant(dynamoOptions != null, 'Parameter \'dynamoOptions\' is not set');
    this._db = new AWS.DynamoDB(dynamoOptions);
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
