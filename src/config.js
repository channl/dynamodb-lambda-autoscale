import ConfigurableProvisioner from './ConfigurableProvisioner';
import RateLimitedDecrement from './RateLimitedDecrement';
import Throughput from './Throughput';

const provisioner = new ConfigurableProvisioner ({
  readCapacity: {
    increment: {
      isAdjustmentRequired: data => Throughput.getReadCapacityUtilisationPercent(data) > 90,
      calculateValue: data => {
        debugger;
        const adjustmentPercent = 100;
        const max = 10;
        const min = 1;
        return Throughput.getPercentAdjustedReadCapacityUnits(adjustmentPercent, max, min);
      },
    },
    decrement: {
      isAdjustmentRequired: data => Throughput.getReadCapacityUtilisationPercent(data) < 30 && RateLimitedDecrement.isDecrementAllowed(data),
      calculateValue: data => Math.max(data.ConsumedThroughput.ReadCapacityUnits, 1),
    }
  },
  writeCapacity: {
    increment: {
      isAdjustmentRequired: data => Throughput.getWriteCapacityUtilisationPercent(data) > 90,
      calculateValue: data => {
        const adjustmentPercent = 100;
        const maxValue = 10;
        const max = 10;
        const min = 1;
        return Throughput.getPercentAdjustedWriteCapacityUnits(adjustmentPercent, maxValue);
      },
    },
    decrement: {
      isAdjustmentRequired: data => Throughput.getWriteCapacityUtilisationPercent(data) < 30 && RateLimitedDecrement.isDecrementAllowed(data),
      calculateValue: data => Math.max(data.ConsumedThroughput.WriteCapacityUnits, 1),
    }
  }
});

const config = {
  connection: {
    dynamoDB: {
      apiVersion: '2012-08-10',
      region:'us-east-1',
      dynamoDbCrc32: false,
      httpOptions: {
        timeout: 5000
      }
    },
    cloudWatch: {
      apiVersion: '2010-08-01',
      region:'us-east-1',
      httpOptions: {
        timeout: 5000
      }
    }
  },
  getTableUpdate: (description, consumedCapacityDescription) => provisioner.getTableUpdate(description, consumedCapacityDescription)
};

export default config;
