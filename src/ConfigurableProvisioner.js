import Global from './global';
const {
  stats,
  logger
} = Global;

class ConfigurableProvisioner {

  constructor(config) {
    this.config = config;
  }

  getTableUpdate(tableDescription, tableConsumedCapacityDescription) {
    try {
      logger.debug('ConfigurableProvisioner.getTableUpdate');

      let tableData = {
        TableName: tableDescription.Table.TableName,
        ProvisionedThroughput: tableDescription.Table.ProvisionedThroughput,
        ConsumedThroughput: tableConsumedCapacityDescription.Table.ConsumedThroughput
      };

      let provisionedThroughput = this.getUpdatedProvisionedThroughput(tableData);
      let gsis = tableDescription.Table.GlobalSecondaryIndexes || [];
      let globalSecondaryIndexUpdates = gsis
        .map(gsi => this.getGlobalSecondaryIndexUpdate(tableDescription, tableConsumedCapacityDescription, gsi))
        .filter(i => i != null);

      if (!provisionedThroughput && (globalSecondaryIndexUpdates ==null || globalSecondaryIndexUpdates.length === 0)) {
        return null;
      }

      let result = {
        TableName: tableDescription.Table.TableName
      };

      if (provisionedThroughput) {
        result.ProvisionedThroughput = provisionedThroughput;
      }

      if (globalSecondaryIndexUpdates && globalSecondaryIndexUpdates.length > 0) {
        result.GlobalSecondaryIndexUpdates = globalSecondaryIndexUpdates;
      }

      return result;
    } catch (e) {
      logger.warn('ConfigurableProvisioner.getTableUpdate failed', JSON.stringify({tableDescription, tableConsumedCapacityDescription}));
      logger.error(e);
    }
  }

  getGlobalSecondaryIndexUpdate(tableDescription, tableConsumedCapacityDescription, gsi){
    try {
      logger.debug('ConfigurableProvisioner.getGlobalSecondaryIndexUpdate');

      let gsicc = tableConsumedCapacityDescription.Table.GlobalSecondaryIndexes.find(i => i.IndexName === gsi.IndexName);
      let provisionedThroughput = this.getUpdatedProvisionedThroughput({
        TableName: tableDescription.Table.TableName,
        IndexName: gsicc.IndexName,
        ProvisionedThroughput: gsi.ProvisionedThroughput,
        ConsumedThroughput: gsicc.ConsumedThroughput
      });

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
      logger.warn('ConfigurableProvisioner.getGlobalSecondaryIndexUpdate failed', JSON.stringify({tableDescription, tableConsumedCapacityDescription, gsi}));
      throw e;
    }
  }

  getUpdatedProvisionedThroughput(params) {
    try {
      logger.debug('ConfigurableProvisioner.getUpdatedProvisionedThroughput');

      let newProvisionedThroughput = {
        ReadCapacityUnits: params.ProvisionedThroughput.ReadCapacityUnits,
        WriteCapacityUnits: params.ProvisionedThroughput.WriteCapacityUnits
      };

      // Adjust read capacity
      if (this.config.readCapacity.increment.isAdjustmentRequired(params, this.config.readCapacity.increment.calculateValue)){
        newProvisionedThroughput.ReadCapacityUnits = this.config.readCapacity.increment.calculateValue(params);
      } else if (this.config.readCapacity.decrement.isAdjustmentRequired(params, this.config.readCapacity.decrement.calculateValue)) {
        newProvisionedThroughput.ReadCapacityUnits = this.config.readCapacity.decrement.calculateValue(params);
      }

      // Adjust write capacity
      if (this.config.writeCapacity.increment.isAdjustmentRequired(params, this.config.writeCapacity.increment.calculateValue)){
        newProvisionedThroughput.WriteCapacityUnits = this.config.writeCapacity.increment.calculateValue(params);
      } else if (this.config.writeCapacity.decrement.isAdjustmentRequired(params, this.config.writeCapacity.decrement.calculateValue)) {
        newProvisionedThroughput.WriteCapacityUnits = this.config.writeCapacity.decrement.calculateValue(params);
      }

      if (newProvisionedThroughput.ReadCapacityUnits === params.ProvisionedThroughput.ReadCapacityUnits
        && newProvisionedThroughput.WriteCapacityUnits === params.ProvisionedThroughput.WriteCapacityUnits) {
        return null;
      }

      return newProvisionedThroughput;
    } catch (e) {
      logger.warn('ConfigurableProvisioner.getUpdatedProvisionedThroughput failed', JSON.stringify({params}));
      throw e;
    }
  }
}

export default ConfigurableProvisioner;
