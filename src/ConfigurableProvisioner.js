/* @flow */
import { json, warning, invariant } from './Global';
import type {
  TableDescription,
  TableConsumedCapacityDescription,
  GlobalSecondaryIndex,
  UpdateTableRequest,
  TableProvisionedAndConsumedThroughput,
  GlobalSecondaryIndexUpdate,
  Throughput,
  ConfigurableProvisionerConfig,
} from './FlowTypes';

export default class ConfigurableProvisioner {
  _config: ConfigurableProvisionerConfig;

  constructor(config: ConfigurableProvisionerConfig) {
    invariant(typeof config !== 'undefined',
      'Parameter \'config\' is not set');

    this._config = config;
  }

  getTableUpdate(
    tableDescription: TableDescription,
    tableConsumedCapacityDescription: TableConsumedCapacityDescription)
    : ?UpdateTableRequest {
    try {
      invariant(typeof tableDescription !== 'undefined',
        'Parameter \'tableDescription\' is not set');
      invariant(typeof tableConsumedCapacityDescription !== 'undefined',
        'Parameter \'tableConsumedCapacityDescription\' is not set');

      let tableData = {
        TableName: tableDescription.TableName,
        ProvisionedThroughput: tableDescription.ProvisionedThroughput,
        ConsumedThroughput: tableConsumedCapacityDescription.ConsumedThroughput
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

  getGlobalSecondaryIndexUpdate(
    tableDescription: TableDescription,
    tableConsumedCapacityDescription: TableConsumedCapacityDescription,
    gsi: GlobalSecondaryIndex): ?GlobalSecondaryIndexUpdate {
    try {
      invariant(typeof tableDescription !== 'undefined',
        'Parameter \'tableDescription\' is not set');
      invariant(typeof tableConsumedCapacityDescription !== 'undefined',
        'Parameter \'tableConsumedCapacityDescription\' is not set');
      invariant(typeof gsi !== 'undefined',
        'Parameter \'gsi\' is not set');

      let gsicc = tableConsumedCapacityDescription
        .GlobalSecondaryIndexes
        .find(i => i.IndexName === gsi.IndexName);

      let provisionedThroughput = this.getUpdatedProvisionedThroughput({
        TableName: tableDescription.TableName,
        IndexName: gsicc.IndexName,
        ProvisionedThroughput: gsi.ProvisionedThroughput,
        ConsumedThroughput: gsicc.ConsumedThroughput
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

  getUpdatedProvisionedThroughput(params: TableProvisionedAndConsumedThroughput)
    : ?Throughput {
    try {
      invariant(typeof params !== 'undefined', 'Parameter \'params\' is not set');

      let newProvisionedThroughput = {
        ReadCapacityUnits: params.ProvisionedThroughput.ReadCapacityUnits,
        WriteCapacityUnits: params.ProvisionedThroughput.WriteCapacityUnits
      };

      // Adjust read capacity
      if (this._config.readCapacity.increment.isAdjustmentRequired(
        params, this._config.readCapacity.increment.calculateValue)) {

        newProvisionedThroughput.ReadCapacityUnits = this._config
          .readCapacity.increment.calculateValue(params);

      } else if (this._config.readCapacity.decrement.isAdjustmentRequired(
        params, this._config.readCapacity.decrement.calculateValue)) {

        newProvisionedThroughput.ReadCapacityUnits = this._config
          .readCapacity.decrement.calculateValue(params);
      }

      // Adjust write capacity
      if (this._config.writeCapacity.increment.isAdjustmentRequired(
        params, this._config.writeCapacity.increment.calculateValue)) {

        newProvisionedThroughput.WriteCapacityUnits = this._config
          .writeCapacity.increment.calculateValue(params);

      } else if (this._config.writeCapacity.decrement.isAdjustmentRequired(
        params, this._config.writeCapacity.decrement.calculateValue)) {

        newProvisionedThroughput.WriteCapacityUnits = this._config
          .writeCapacity.decrement.calculateValue(params);
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
}
