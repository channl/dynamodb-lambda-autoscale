import ConfigurableProvisioner from './ConfigurableProvisioner';
import RateLimitedDecrement from './RateLimitedDecrement';
import Throughput from './Throughput';
import { invariant } from '../src/Global';

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

        let isAboveThreshold = Throughput.getReadCapacityUtilisationPercent(data) >
          config.readCapacity.increment.thresholdPercent;

        let isBelowMin = data.ProvisionedThroughput.ReadCapacityUnits <
          config.readCapacity.min;

        return isAboveThreshold || isBelowMin;
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

        let isBelowThreshold = Throughput.getReadCapacityUtilisationPercent(data) <
          config.readCapacity.decrement.thresholdPercent;

        let isAboveMax = data.ProvisionedThroughput.ReadCapacityUnits >
          config.readCapacity.max;

        return isReadDecrementAllowed && (isBelowThreshold || isAboveMax);
      },
      calculateValue: data => {
        invariant(typeof data !== 'undefined', 'Parameter \'data\' is not set');

        return Math.max(data.ConsumedThroughput.ReadCapacityUnits, config.readCapacity.min);
      },
    }
  },
  writeCapacity: {
    increment: {
      isAdjustmentRequired: (data, calcFunc) => {
        invariant(typeof data !== 'undefined', 'Parameter \'data\' is not set');
        invariant(typeof calcFunc !== 'undefined', 'Parameter \'calcFunc\' is not set');

        let isAboveThreshold = Throughput.getWriteCapacityUtilisationPercent(data) >
          config.writeCapacity.increment.thresholdPercent;

        let isBelowMin = data.ProvisionedThroughput.WriteCapacityUnits <
          config.writeCapacity.min;

        return isAboveThreshold || isBelowMin;
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

        let isBelowThreshold = Throughput.getWriteCapacityUtilisationPercent(data) <
          config.writeCapacity.decrement.thresholdPercent;

        let isAboveMax = data.ProvisionedThroughput.WriteCapacityUnits >
          config.writeCapacity.max;

        return isWriteDecrementAllowed && (isBelowThreshold || isAboveMax);
      },
      calculateValue: data => {
        invariant(typeof data !== 'undefined', 'Parameter \'data\' is not set');

        return Math.max(data.ConsumedThroughput.WriteCapacityUnits, config.writeCapacity.min);
      },
    }
  }
});

export default {
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
  getTableUpdate: (description, consumedCapacityDescription) => {
    invariant(typeof description !== 'undefined', 'Parameter \'description\' is not set');
    invariant(typeof consumedCapacityDescription !== 'undefined',
      'Parameter \'consumedCapacityDescription\' is not set');

    return provisioner.getTableUpdate(description, consumedCapacityDescription);
  }
};
