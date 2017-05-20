/* @flow */
import DynamoDBAutoscaler from './DynamoDBAutoscaler';
import CloudWatch from './aws/CloudWatch';
import DynamoDB from './aws/DynamoDB';
import ConsumedThroughputCalculator from './ConsumedThroughputCalculator';
import ProvisionedThroughtputCalculator from './ProvisionedThroughtputCalculator';

export {
  CloudWatch,
  DynamoDB,
  DynamoDBAutoscaler,
  ConsumedThroughputCalculator,
  ProvisionedThroughtputCalculator,
};
