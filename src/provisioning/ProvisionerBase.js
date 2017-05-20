/* @flow */
/* eslint-disable no-unused-vars */
import invariant from 'invariant';
import type { TableDescription, UpdateTableRequest } from 'aws-sdk';
import type { TableConsumedCapacityDescription } from '../flow/FlowTypes';
import DynamoDB from '../aws/DynamoDB';
import CloudWatch from '../aws/CloudWatch';

export default class ProvisionerBase {
  db: DynamoDB;

  constructor() {
    this.db = DynamoDB.create(this.getDynamoDBRegion());
  }

  getDynamoDBRegion(): string {
    invariant(false, 'The method \'getDynamoDBRegion\' was not implemented');
  }

  async getTableNamesAsync(): Promise<string[]> {
    invariant(false, 'The method \'getTableNamesAsync\' was not implemented');
  }

  async getTableUpdateAsync(
    tableDescription: TableDescription,
    tableConsumedCapacityDescription: TableConsumedCapacityDescription):
    Promise<?UpdateTableRequest> {
    invariant(false, 'The method \'getTableUpdateAsync\' was not implemented');
  }
}
