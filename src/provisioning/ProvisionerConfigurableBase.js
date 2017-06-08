/* @flow */
import { json, warning, invariant } from '../Global';
import ProvisionerBase from '../provisioning/ProvisionerBase';
import type {
  TableDescription,
  GlobalSecondaryIndex,
  UpdateTableRequest,
  GlobalSecondaryIndexUpdate,
  Throughput,
} from 'aws-sdk';
import type {
  TableProvisionedAndConsumedThroughput,
  TableConsumedCapacityDescription,
} from '../flow/FlowTypes';

export default class ProvisionerConfigurableBase extends ProvisionerBase {

  // eslint-disable-next-line no-unused-vars
  isReadCapacityIncrementRequired(data: TableProvisionedAndConsumedThroughput): boolean {
    invariant(false, 'The method \'isReadCapacityIncrementRequired\' was not implemented');
  }

  // eslint-disable-next-line no-unused-vars
  calculateIncrementedReadCapacityValue(data: TableProvisionedAndConsumedThroughput): number {
    invariant(false, 'The method \'calculateIncrementedReadCapacityValue\' was not implemented');
  }

  // eslint-disable-next-line no-unused-vars
  isReadCapacityDecrementRequired(data: TableProvisionedAndConsumedThroughput): boolean {
    invariant(false, 'The method \'isReadCapacityDecrementRequired\' was not implemented');
  }

  // eslint-disable-next-line no-unused-vars
  calculateDecrementedReadCapacityValue(data: TableProvisionedAndConsumedThroughput): number {
    invariant(false, 'The method \'calculateDecrementedReadCapacityValue\' was not implemented');
  }

  // eslint-disable-next-line no-unused-vars
  isWriteCapacityIncrementRequired(data: TableProvisionedAndConsumedThroughput): boolean {
    invariant(false, 'The method \'isWriteCapacityIncrementRequired\' was not implemented');
  }

  // eslint-disable-next-line no-unused-vars
  calculateIncrementedWriteCapacityValue(data: TableProvisionedAndConsumedThroughput): number {
    invariant(false, 'The method \'calculateIncrementedWriteCapacityValue\' was not implemented');
  }

  // eslint-disable-next-line no-unused-vars
  isWriteCapacityDecrementRequired(data: TableProvisionedAndConsumedThroughput): boolean {
    invariant(false, 'The method \'isWriteCapacityDecrementRequired\' was not implemented');
  }

  // eslint-disable-next-line no-unused-vars
  calculateDecrementedWriteCapacityValue(data: TableProvisionedAndConsumedThroughput): number {
    invariant(false, 'The method \'calculateDecrementedWriteCapacityValue\' was not implemented');
  }

  async getTableNamesAsync(): Promise<string[]> {
    invariant(false, 'The method \'getTableNamesAsync\' was not implemented');
  }

  async getTableUpdateAsync(tableDescription: TableDescription,
    tableConsumedCapacityDescription: TableConsumedCapacityDescription) :
    Promise<?UpdateTableRequest> {
    try {
      invariant(tableDescription != null, 'Parameter \'tableDescription\' is not set');
      invariant(tableConsumedCapacityDescription != null,
        'Parameter \'tableConsumedCapacityDescription\' is not set');

      let tableData = {
        TableName: tableDescription.TableName,
        ProvisionedThroughput: tableDescription.ProvisionedThroughput,
        ConsumedThroughput: tableConsumedCapacityDescription.ConsumedThroughput,
        ThrottledEvents: tableConsumedCapacityDescription.ThrottledEvents
      };

      let provisionedThroughput = this.getUpdatedProvisionedThroughput(tableData);

      let gsis = tableDescription.GlobalSecondaryIndexes || [];
      let globalSecondaryIndexUpdates = gsis
        // $FlowIgnore
        .map(gsi => this.getGlobalSecondaryIndexUpdate(
          tableDescription, tableConsumedCapacityDescription, gsi))
        .filter(i => i !== null);

      // eslint-disable-next-line eqeqeq
      if (!provisionedThroughput && (globalSecondaryIndexUpdates == null ||
        globalSecondaryIndexUpdates.length === 0)) {
        return null;
      }

      let result: UpdateTableRequest = {
        TableName: tableDescription.TableName
      };

      if (provisionedThroughput) {
        result.ProvisionedThroughput = provisionedThroughput;
      }

      if (globalSecondaryIndexUpdates && globalSecondaryIndexUpdates.length > 0) {
        result.GlobalSecondaryIndexUpdates = globalSecondaryIndexUpdates;
      }

      return result;
    } catch (e) {
      warning(JSON.stringify({
        class: 'ConfigurableProvisioner',
        function: 'getTableUpdate',
        tableDescription,
        tableConsumedCapacityDescription
      }, null, json.padding));
      throw e;
    }
  }

  getUpdatedProvisionedThroughput(params: TableProvisionedAndConsumedThroughput)
    : ?Throughput {
    try {
      invariant(params != null, 'Parameter \'params\' is not set');

      let newProvisionedThroughput = {
        ReadCapacityUnits: params.ProvisionedThroughput.ReadCapacityUnits,
        WriteCapacityUnits: params.ProvisionedThroughput.WriteCapacityUnits
      };

      // Adjust read capacity
      if (this.isReadCapacityIncrementRequired(params)) {
        newProvisionedThroughput.ReadCapacityUnits = this
          .calculateIncrementedReadCapacityValue(params);

      } else if (this.isReadCapacityDecrementRequired(params)) {
        newProvisionedThroughput.ReadCapacityUnits = this
          .calculateDecrementedReadCapacityValue(params);
      }

      // Adjust write capacity
      if (this.isWriteCapacityIncrementRequired(params)) {
        newProvisionedThroughput.WriteCapacityUnits = this
          .calculateIncrementedWriteCapacityValue(params);

      } else if (this.isWriteCapacityDecrementRequired(params)) {
        newProvisionedThroughput.WriteCapacityUnits = this
          .calculateDecrementedWriteCapacityValue(params);
      }

      if (newProvisionedThroughput.ReadCapacityUnits ===
        params.ProvisionedThroughput.ReadCapacityUnits &&
        newProvisionedThroughput.WriteCapacityUnits ===
        params.ProvisionedThroughput.WriteCapacityUnits) {
        return null;
      }

      return newProvisionedThroughput;
    } catch (e) {
      warning(JSON.stringify({
        class: 'ConfigurableProvisioner',
        function: 'getUpdatedProvisionedThroughput', params
      }, null, json.padding));
      throw e;
    }
  }

  getGlobalSecondaryIndexUpdate(
    tableDescription: TableDescription,
    tableConsumedCapacityDescription: TableConsumedCapacityDescription,
    gsi: GlobalSecondaryIndex): ?GlobalSecondaryIndexUpdate {
    try {
      invariant(tableDescription != null, 'Parameter \'tableDescription\' is not set');
      invariant(tableConsumedCapacityDescription != null,
        'Parameter \'tableConsumedCapacityDescription\' is not set');
      invariant(gsi != null, 'Parameter \'gsi\' is not set');

      let gsicc = tableConsumedCapacityDescription
        .GlobalSecondaryIndexes
        .find(i => i.IndexName === gsi.IndexName);

      invariant(gsicc != null, 'Specified GSI could not be found');
      let provisionedThroughput = this.getUpdatedProvisionedThroughput({
        TableName: tableDescription.TableName,
        IndexName: gsicc.IndexName,
        ProvisionedThroughput: gsi.ProvisionedThroughput,
        ConsumedThroughput: gsicc.ConsumedThroughput,
        ThrottledEvents: gsicc.ThrottledEvents
      });

      // eslint-disable-next-line eqeqeq
      if (provisionedThroughput == null) {
        return null;
      }

      return {
        Update: {
          IndexName: gsi.IndexName,
          ProvisionedThroughput: provisionedThroughput
        }
      };
    } catch (e) {
      warning(JSON.stringify({
        class: 'ConfigurableProvisioner',
        function: 'getGlobalSecondaryIndexUpdate',
        tableDescription,
        tableConsumedCapacityDescription,
        gsi
      }, null, json.padding));
      throw e;
    }
  }
}
