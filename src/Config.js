/* @flow */
import ConfigurableProvisioner from './ConfigurableProvisioner';
import RateLimitedDecrement from './RateLimitedDecrement';
import Throughput from './Throughput';
import { log, invariant } from './Global';
import DynamoDB from './DynamoDB';
import type { TableDescription } from 'aws-sdk-promise';
import type { Config, TableConsumedCapacityDescription } from './FlowTypes';

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
        let isBelowMin = data.ProvisionedThroughput.ReadCapacityUnits < config.readCapacity.min;
        let isAtMax = data.ProvisionedThroughput.ReadCapacityUnits >= config.readCapacity.max;
        let isAdjustmentRequired = isAboveThreshold || isBelowMin;

        // Logging
        let logMessage = typeof data.IndexName === 'undefined' ? data.TableName :
          data.TableName + '.' + data.IndexName;
        logMessage += ' is consuming ' + data.ConsumedThroughput.ReadCapacityUnits + ' of ' +
          data.ProvisionedThroughput.ReadCapacityUnits + ' (' + readCapacityPercent +
          '%) read capacity units';
        if (isAtMax) {
          logMessage += ' and is already at max allowed ' + config.readCapacity.max + ' units';
        }
        if (isAboveThreshold && !isAtMax) {
          logMessage += ' and is above maximum threshold of ' +
            config.readCapacity.increment.thresholdPercent + '%';
        }
        if (isBelowMin) {
          logMessage += ' and is below the min allowed ' + config.readCapacity.min + ' units';
        }
        if (isAdjustmentRequired) {
          logMessage += ' so an increment is REQUIRED';
        } else {
          logMessage += ' so an increment is not required';
        }
        log(logMessage);

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
        let isAboveMax = data.ProvisionedThroughput.ReadCapacityUnits > config.readCapacity.max;
        let isAtMin = data.ProvisionedThroughput.ReadCapacityUnits <= config.readCapacity.min;
        let isAdjustmentWanted = (isBelowThreshold || isAboveMax) && !isAtMin;
        let isAdjustmentRequired = isReadDecrementAllowed && isAdjustmentWanted;

        // Logging
        let logMessage = typeof data.IndexName === 'undefined' ? data.TableName :
          data.TableName + '.' + data.IndexName;
        logMessage += ' is consuming ' + data.ConsumedThroughput.ReadCapacityUnits + ' of ' +
          data.ProvisionedThroughput.ReadCapacityUnits + ' (' + readCapacityPercent +
          '%) read capacity units';
        if (isAtMin) {
          logMessage += ' and is already at min allowed ' + config.readCapacity.min + ' units';
        }
        if (isBelowThreshold && !isAtMin) {
          logMessage += ' and is below minimum threshold of ' +
            config.readCapacity.decrement.thresholdPercent + '%';
        }
        if (isAboveMax) {
          logMessage += ' and is above the max allowed ' + config.readCapacity.max + ' units';
        }
        if (isAdjustmentWanted) {
          logMessage += ' so a decrement is REQUESTED';
        } else {
          logMessage += ' so a decrement is not required';
        }
        if (isAdjustmentWanted && !isReadDecrementAllowed) {
          logMessage += ' but has been DISALLOWED due to rate limiting';
        }
        log(logMessage);

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
        let isAtMax = data.ProvisionedThroughput.WriteCapacityUnits >= config.writeCapacity.max;
        let isBelowMin = data.ProvisionedThroughput.WriteCapacityUnits < config.writeCapacity.min;
        let isAdjustmentRequired = isAboveThreshold || isBelowMin;

        // Logging
        let logMessage = typeof data.IndexName === 'undefined' ? data.TableName :
          data.TableName + '.' + data.IndexName;
        logMessage += ' is consuming ' + data.ConsumedThroughput.WriteCapacityUnits + ' of ' +
          data.ProvisionedThroughput.WriteCapacityUnits + ' (' + writeCapacityPercent +
          '%) write capacity units';
        if (isAtMax) {
          logMessage += ' and is already at max allowed ' + config.writeCapacity.max + ' units';
        }
        if (isAboveThreshold && !isAtMax) {
          logMessage += ' and is above maximum threshold of ' +
            config.writeCapacity.increment.thresholdPercent + '%';
        }
        if (isBelowMin) {
          logMessage += ' and is below the min allowed ' + config.writeCapacity.min + ' units';
        }
        if (isAdjustmentRequired) {
          logMessage += ' so an increment is REQUIRED';
        } else {
          logMessage += ' so an increment is not required';
        }
        log(logMessage);

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
        let isAtMin = data.ProvisionedThroughput.WriteCapacityUnits <= config.writeCapacity.min;
        let isAboveMax = data.ProvisionedThroughput.WriteCapacityUnits > config.writeCapacity.max;
        let isAdjustmentWanted = (isBelowThreshold || isAboveMax) && !isAtMin;
        let isAdjustmentRequired = isWriteDecrementAllowed && isAdjustmentWanted;

        // Logging
        let logMessage = typeof data.IndexName === 'undefined' ? data.TableName :
          data.TableName + '.' + data.IndexName;
        logMessage += ' is consuming ' + data.ConsumedThroughput.WriteCapacityUnits + ' of ' +
          data.ProvisionedThroughput.WriteCapacityUnits + ' (' + writeCapacityPercent +
          '%) write capacity units';
        if (isAtMin) {
          logMessage += ' and is already at min allowed ' + config.writeCapacity.min + ' units';
        }
        if (isBelowThreshold && !isAtMin) {
          logMessage += ' and is below minimum threshold of ' +
            config.writeCapacity.decrement.thresholdPercent + '%';
        }
        if (isAboveMax) {
          logMessage += ' and is above the max allowed ' + config.writeCapacity.max + ' units';
        }
        if (isAdjustmentWanted) {
          logMessage += ' so a decrement is REQUESTED';
        } else {
          logMessage += ' so a decrement is not required';
        }
        if (isAdjustmentWanted && !isWriteDecrementAllowed) {
          logMessage += ' but has been DISALLOWED due to rate limiting';
        }
        log(logMessage);

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
