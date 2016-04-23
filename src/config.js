import ConfigurableProvisioner from './ConfigurableProvisioner';

const provisioner = new ConfigurableProvisioner ({
  readCapacity: {
    min: 1,
    max: 10,
    increment: {
      threshold: { percent: 90 },
      adjustment: { percent: 100 },
    },
    decrement: {
      threshold: { percent: 30 },
      adjustment: { percent: 30 },
    }
  },
  writeCapacity: {
    min: 1,
    max: 10,
    increment: {
      threshold: { percent: 90 },
      adjustment: { percent: 100 },
    },
    decrement: {
      threshold: { percent: 30 },
      adjustment: { percent: 30 },
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
  getTableUpdate: (desc, capDesc) => provisioner.getTableUpdate(desc, capDesc)
};

export default config;
