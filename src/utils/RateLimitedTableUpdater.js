/* @flow */
import invariant from 'invariant';
import Delay from '../utils/Delay';
import Async from 'async';
import type { DescribeTableRequest, DescribeTableResponse, UpdateTableRequest, UpdateTableResponse } from 'aws-sdk';

export default class RateLimitedTableUpdater {
  _describeTableAsync: (params: DescribeTableRequest) => Promise<DescribeTableResponse>;
  _updateTableAsync: (params: UpdateTableRequest) => Promise<UpdateTableResponse>;
  _updatePool: Async.QueueObject<UpdateTableRequest, UpdateTableResponse>;

  constructor(
    describeTableAsync: (params: DescribeTableRequest) => Promise<DescribeTableResponse>,
    updateTableAsync: (params: UpdateTableRequest) => Promise<UpdateTableResponse>,
  ) {
    invariant(describeTableAsync != null, 'Parameter describeTableAsync is not set');
    invariant(updateTableAsync != null, 'Parameter updateTableAsync is not set');
    this._describeTableAsync = describeTableAsync;
    this._updateTableAsync = updateTableAsync;
    this._updatePool = Async.queue(
      async (params: UpdateTableRequest, callback: (result: UpdateTableResponse) => void) => {
        let result = await this._updateTableAndWaitAsync(params);
        callback(result);
      },
      10,
    );
  }

  updateTableAsync(params: UpdateTableRequest): Promise<UpdateTableResponse> {
    return new Promise((resolve, reject) => {
      try {
        invariant(params != null, 'Parameter params is not set');
        this._updatePool.push(params, resolve);
      } catch (ex) {
        reject(ex);
      }
    });
  }

  async _updateTableAndWaitAsync(params: UpdateTableRequest): Promise<UpdateTableResponse> {
    let response = await this._updateTableAsync(params);
    await this._delayUntilTableIsActiveAsync(params.TableName);
    return response;
  }

  async _delayUntilTableIsActiveAsync(tableName: string): Promise<void> {
    let isActive = false;
    let attempt = 0;
    do {
      let result = await this._describeTableAsync({ TableName: tableName });
      isActive = result.Table.TableStatus === 'ACTIVE';
      if (!isActive) {
        await Delay.delayAsync(1000);
        attempt++;
      }
    } while (!isActive && attempt < 10);
  }
}
