import CapacityCalculator from './CapacityCalculator';
import Global from './global';
const {
  stats,
  logger
} = Global;

class ConfigurableProvisioner {

  constructor(config) {
    this.config = config;
    this.capacityCalculator = new CapacityCalculator();
  }

  async getTableUpdateAsync(tableDescription, tableConsumedCapacityDescription) {
    let provisionedThroughput = this.getProvisionedThroughput(
      tableDescription.Table.ProvisionedThroughput,
      tableConsumedCapacityDescription.Table.ConsumedThroughput,
      tableDescription.Table.TableName);

    let gsis = tableDescription.Table.GlobalSecondaryIndexes || [];
    let globalSecondaryIndexUpdates = gsis
      .map(gsi => {
        let gsicc = tableConsumedCapacityDescription.Table.GlobalSecondaryIndexes.find(i => i.IndexName === gsi.IndexName);
        let provisionedThroughput = this.getProvisionedThroughput(gsi.ProvisionedThroughput, gsicc.ConsumedThroughput, tableDescription.Table.TableName, gsicc.IndexName);
        if (!provisionedThroughput) {
          return null;
        }

        return {
          Update: {
            IndexName: gsi.IndexName,
            ProvisionedThroughput: provisionedThroughput
          }
        };
      })
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
  }

  parseDate(value) {
    if (typeof value === 'undefined' || value == null) {
       return new Date(-8640000000000000);
    }

    return Date.parse(value);
  }

  getMax(value) {
    if (typeof value === 'undefined') {
      return 40000;
    }

    return value;
  }

  getMin(value) {
    if (typeof value === 'undefined') {
      return 1;
    }

    return value;
  }

  getProvisionedThroughput(provisionedThroughput, consumedThroughput, tableName, indexName) {
    // logger.debug(JSON.stringify({tableName, indexName, provisionedThroughput, consumedThroughput}, null, 2));

    let ReadCapacityUnits = this.capacityCalculator.getNewCapacity(
      provisionedThroughput.ReadCapacityUnits,
      consumedThroughput.ReadCapacityUnits,
      this.config.readCapacity.increment.threshold.percent,
      this.config.readCapacity.decrement.threshold.percent,
      this.config.readCapacity.increment.adjustment.percent,
      this.config.readCapacity.decrement.adjustment.percent,
      this.getMin(this.config.readCapacity.min),
      this.getMax(this.config.readCapacity.max),
      provisionedThroughput.NumberOfDecreasesToday,
      this.parseDate(provisionedThroughput.LastIncreaseDateTime),
      this.parseDate(provisionedThroughput.LastDecreaseDateTime)
    );

    let WriteCapacityUnits = this.capacityCalculator.getNewCapacity(
      provisionedThroughput.WriteCapacityUnits,
      consumedThroughput.WriteCapacityUnits,
      this.config.writeCapacity.increment.threshold.percent,
      this.config.writeCapacity.decrement.threshold.percent,
      this.config.writeCapacity.increment.adjustment.percent,
      this.config.writeCapacity.decrement.adjustment.percent,
      this.getMin(this.config.writeCapacity.min),
      this.getMax(this.config.writeCapacity.max),
      provisionedThroughput.NumberOfDecreasesToday,
      this.parseDate(provisionedThroughput.LastIncreaseDateTime),
      this.parseDate(provisionedThroughput.LastDecreaseDateTime)
    );

    if (ReadCapacityUnits === provisionedThroughput.ReadCapacityUnits
      && WriteCapacityUnits === provisionedThroughput.WriteCapacityUnits) {
      return null;
    }

    let newProvisionedThroughput = {
      ReadCapacityUnits,
      WriteCapacityUnits
    };

    return newProvisionedThroughput;
  }
}

export default ConfigurableProvisioner;
