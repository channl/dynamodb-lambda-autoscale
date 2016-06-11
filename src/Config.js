/* @flow */
import ConfigurableProvisioner from './ConfigurableProvisioner';
import RateLimitedDecrement from './RateLimitedDecrement';
import Throughput from './Throughput';
import { log, invariant } from './Global';
import DynamoDB from './DynamoDB';
import type { TableDescription, TableConsumedCapacityDescription, Config } from './FlowTypes';
// NOTES
// - 'adjustmentPercent' or 'adjustmentUnits' is used, which ever is bigger
// - 'min' and 'max' are hard limits
// - 'minAdjustment' is minimum possible downward adjustment, there is no point
//   wasting 1 of 4 daily decrements on a small value

const config = {
  readCapacity: {
    min: 1,
    max: 10,
    increment: {
      thresholdPercent: 90,
      adjustmentPercent: 100,
      adjustmentUnits: 3,
    },
    decrement: {
      thresholdPercent: 30,
      minAdjustment: 3,
      minGracePeriodAfterLastIncrementMinutes: 60,
      minGracePeriodAfterLastDecrementMinutes: 60,
    },
  },
  writeCapacity: {
    min: 1,
    max: 10,
    increment: {
      thresholdPercent: 90,
      adjustmentPercent: 100,
      adjustmentUnits: 3,
    },
    decrement: {
      thresholdPercent: 30,
      minAdjustment: 3,
      minGracePeriodAfterLastIncrementMinutes: 60,
      minGracePeriodAfterLastDecrementMinutes: 60,
    },
  },
};

const provisioner = new ConfigurableProvisioner({
  readCapacity: {
    increment: {
      isAdjustmentRequired: (data, calcFunc) => {
        invariant(typeof data !== 'undefined', 'Parameter \'data\' is not set');
        invariant(typeof calcFunc !== 'undefined', 'Parameter \'calcFunc\' is not set');

        let readCapacityPercent = Throughput.getReadCapacityUtilisationPercent(data);
        let isAboveThreshold = readCapacityPercent > config.readCapacity.increment.thresholdPercent;
        let isBelowMin = data.ProvisionedThroughput.ReadCapacityUnits <
          config.readCapacity.min;
        let isAdjustmentRequired = isAboveThreshold || isBelowMin;

        let logName = typeof data.IndexName === 'undefined' ? data.TableName :
          data.TableName + '.' + data.IndexName;

        if (isAboveThreshold) {
          log(logName + ' is at ' + readCapacityPercent +
            '% read capacity and above threshold of ' +
            config.readCapacity.increment.thresholdPercent + '%');
        } else if (isBelowMin) {
          log(logName + ' is at ' + readCapacityPercent +
            '% read capacity and below minimum of ' + config.readCapacity.min + '%');
        } else if (readCapacityPercent > 0) {
          log(logName + ' is at ' + readCapacityPercent +
            '% read capacity and within minimum of ' + config.readCapacity.min +
            '% and threshold of ' + config.readCapacity.increment.thresholdPercent + '%');
        }

        return isAdjustmentRequired;
      },
      calculateValue: data => {
        invariant(typeof data !== 'undefined', 'Parameter \'data\' is not set');

        return Throughput.getPercentAdjustedReadCapacityUnits(
          data,
          config.readCapacity.increment.adjustmentPercent,
          config.readCapacity.increment.adjustmentUnits,
          config.readCapacity.max,
          config.readCapacity.min);
      },
    },
    decrement: {
      isAdjustmentRequired: (data, calcFunc) => {
        invariant(typeof data !== 'undefined', 'Parameter \'data\' is not set');
        invariant(typeof calcFunc !== 'undefined', 'Parameter \'calcFunc\' is not set');

        let isReadDecrementAllowed =
          RateLimitedDecrement.isReadDecrementAllowed(
            data,
            calcFunc,
            config.readCapacity.decrement.minAdjustment,
            config.readCapacity.decrement.minGracePeriodAfterLastIncrementMinutes,
            config.readCapacity.decrement.minGracePeriodAfterLastDecrementMinutes);

        let readCapacityPercent = Throughput.getReadCapacityUtilisationPercent(data);
        let isBelowThreshold = readCapacityPercent < config.readCapacity.decrement.thresholdPercent;
        let isAboveMax = data.ProvisionedThroughput.ReadCapacityUnits >
          config.readCapacity.max;

        let isAdjustmentWanted = isBelowThreshold || isAboveMax;
        let isAdjustmentRequired = isReadDecrementAllowed && isAdjustmentWanted;
        return isAdjustmentRequired;
      },
      calculateValue: data => {
        invariant(typeof data !== 'undefined', 'Parameter \'data\' is not set');

        return Math.round(Math.max(data.ConsumedThroughput.ReadCapacityUnits,
          config.readCapacity.min));
      },
    }
  },
  writeCapacity: {
    increment: {
      isAdjustmentRequired: (data, calcFunc) => {
        invariant(typeof data !== 'undefined', 'Parameter \'data\' is not set');
        invariant(typeof calcFunc !== 'undefined', 'Parameter \'calcFunc\' is not set');

        let writeCapacityPercent = Throughput.getWriteCapacityUtilisationPercent(data);
        let isAboveThreshold = writeCapacityPercent >
          config.writeCapacity.increment.thresholdPercent;
        let isBelowMin = data.ProvisionedThroughput.WriteCapacityUnits < config.writeCapacity.min;
        let isAdjustmentRequired = isAboveThreshold || isBelowMin;

        let logName = typeof data.IndexName === 'undefined' ? data.TableName :
          data.TableName + '.' + data.IndexName;

        if (isAboveThreshold) {
          log(logName + ' is at ' + writeCapacityPercent +
            '% write capacity and above threshold of ' +
            config.writeCapacity.increment.thresholdPercent + '%');
        } else if (isBelowMin) {
          log(logName + ' is at ' + writeCapacityPercent +
            '% write capacity and below minimum of ' + config.writeCapacity.min + '%');
        } else if (writeCapacityPercent > 0) {
          log(logName + ' is at ' + writeCapacityPercent +
            '% write capacity and within minimum of ' + config.writeCapacity.min +
            '% and threshold of ' + config.writeCapacity.increment.thresholdPercent + '%');
        }

        return isAdjustmentRequired;
      },
      calculateValue: data => {
        invariant(typeof data !== 'undefined', 'Parameter \'data\' is not set');

        return Throughput.getPercentAdjustedWriteCapacityUnits(
          data,
          config.writeCapacity.increment.adjustmentPercent,
          config.writeCapacity.increment.adjustmentUnits,
          config.writeCapacity.max,
          config.writeCapacity.min);
      },
    },
    decrement: {
      isAdjustmentRequired: (data, calcFunc) => {
        invariant(typeof data !== 'undefined', 'Parameter \'data\' is not set');
        invariant(typeof calcFunc !== 'undefined', 'Parameter \'calcFunc\' is not set');

        let isWriteDecrementAllowed =
          RateLimitedDecrement.isWriteDecrementAllowed(
            data,
            calcFunc,
            config.writeCapacity.decrement.minAdjustment,
            config.writeCapacity.decrement.minGracePeriodAfterLastIncrementMinutes,
            config.writeCapacity.decrement.minGracePeriodAfterLastDecrementMinutes);

        let writeCapacityPercent = Throughput.getWriteCapacityUtilisationPercent(data);
        let isBelowThreshold = writeCapacityPercent <
          config.writeCapacity.decrement.thresholdPercent;

        let isAboveMax = data.ProvisionedThroughput.WriteCapacityUnits > config.writeCapacity.max;
        let isAdjustmentWanted = isBelowThreshold || isAboveMax;
        let isAdjustmentRequired = isWriteDecrementAllowed && isAdjustmentWanted;
        return isAdjustmentRequired;
      },
      calculateValue: data => {
        invariant(typeof data !== 'undefined', 'Parameter \'data\' is not set');

        return Math.round(Math.max(data.ConsumedThroughput.WriteCapacityUnits,
          config.writeCapacity.min));
      },
    }
  }
});

let configuration: Config = {
  connection: {
    dynamoDB: {
      apiVersion: '2012-08-10',
      region: 'us-east-1',
      dynamoDbCrc32: false,
      httpOptions: {
        timeout: 5000
      }
    },
    cloudWatch: {
      apiVersion: '2010-08-01',
      region: 'us-east-1',
      httpOptions: {
        timeout: 5000
      }
    }
  },
  getTableNamesAsync: async (db: DynamoDB) => {

    // Ensure all tables are in scope for autoscaling
    let listTablesResponse = await db.listTablesAsync();
    return listTablesResponse.TableNames;
  },
  getTableUpdate: (
    description: TableDescription,
    consumedCapacityDescription: TableConsumedCapacityDescription) => {
    invariant(typeof description !== 'undefined', 'Parameter \'description\' is not set');
    invariant(typeof consumedCapacityDescription !== 'undefined',
      'Parameter \'consumedCapacityDescription\' is not set');

    // Construct a table update request to send to AWS
    return provisioner.getTableUpdate(description, consumedCapacityDescription);
  }
};

export default configuration;
