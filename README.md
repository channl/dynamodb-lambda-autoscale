# dynamodb-lambda-autoscale
**Autoscale AWS DynamoDB using an AWS Lambda function**

+ 5 minute setup process
+ Serverless design
+ Flexible code over configuration style
+ Autoscale table and global secondary indexes
+ Autoscale multiple tables
+ Autoscale by fixed settings
+ Autoscale by provisioned capacity utilisation
+ Autoscale by throttled event metrics
+ Optimised for large spikes in usage and hotkey issues by incorporating throttled event metrics
+ Optimised performance using concurrent queries
+ RateLimitedDecrement as imposed by AWS
+ Statistics via 'measured'
+ AWS credential configuration via 'dotenv'
+ Optimised lambda package via 'webpack'
+ ES7 code
+ 100% [Flow](https://flowtype.org/) static type checking coverage

## Disclaimer

Any reliance you place on dynamodb-lambda-autoscale is strictly at your own
risk.

In no event will we be liable for any loss or damage including without
limitation, indirect or consequential loss or damage, or any loss or damage
whatsoever arising from loss of data or profits arising out of, or in
connection with, the use of this code.

## Getting started

Note: dynamodb-lambda-autoscale uses [Flow](https://flowtype.org/) extensively for static type
checking, we highly recommend you use [Nuclide](https://nuclide.io/) when making modification to code /
configuration.  Please see the respective websites for advantages / reasons.

1. Build and package the code
  1. Fork the repo
  2. Clone your fork
  3. Create a new file in the root folder called 'config.env.production'
  4. Put your AWS credentials into the file in the following format, only if you want to run a local test (not needed for lambda)

    ```javascript
    AWS_ACCESS_KEY_ID="###################"
    AWS_SECRET_ACCESS_KEY="###############"
    ```

  5. Update [Region.json](./src/configuration/Region.json) to match the region of your DynamoDB instance
  6. Run 'npm install'
  7. Run 'npm run build'
  8. Verify this has created a 'dist.zip' file
  9. Optionally, run a local test by running 'npm run start'

## Running on AWS Lambda

1. Follow the steps in 'Running locally'
2. Create an AWS Policy and Role
  1. Create a policy called 'DynamoDBLambdaAutoscale'
  2. Use the following content to give access to dynamoDB, cloudwatch and lambda logging

      ```javascript
      {
        "Version": "2012-10-17",
        "Statement": [
          {
            "Action": [
              "dynamodb:ListTables",
              "dynamodb:DescribeTable",
              "dynamodb:UpdateTable",
              "cloudwatch:GetMetricStatistics",
              "logs:CreateLogGroup",
              "logs:CreateLogStream",
              "logs:PutLogEvents"
            ],
            "Effect": "Allow",
            "Resource": "*"
          }
        ]
      }
      ```

  3. Create a role called 'DynamoDBLambdaAutoscale'
  4. Attach the newly created policy to the role
3. Create a AWS Lambda function
  1. Skip the pre defined functions step
  2. Set the name to 'DynamoDBLambdaAutoscale'
  3. Set the runtime to 'Node.js 4.3'
  4. Select upload a zip file and select 'dist.zip' which you created earlier
  5. Set the handler to 'index.handler'
  6. Set the Role to 'DynamoDBLambdaAutoscale'
  7. Set the Memory to the lowest value initially but test different values at a later date to see how it affects performance
  8. Set the Timeout to approximately 5 seconds (higher or lower depending on the amount of tables you have and the selected memory setting)
  9. Once the function is created, attach a 'scheduled event' event source and make it run every minute.  Event Sources > Add Event Source > Event Type = Cloudwatch Events - Schedule. Set the name to 'DynamoDBLambdaAutoscale' and the schedule expression to 'rate(1 minute)'

## Configuration

The default setup in the [Provisioner.js](./src/Provisioner.js) allows for a quick no touch setup.
A breakdown of the configuration behaviour is as follows:
- AWS region is set to 'us-east-1' via [Region.json](./src/configuration/Region.json) configuration
- Autoscales all tables and indexes
- Autoscaling 'Strategy' settings are defined in [DefaultProvisioner.json](./src/configuration/DefaultProvisioner.json) and are as follows
  - Separate 'Read' and 'Write' capacity adjustment strategies
  - Separate asymmetric 'Increment' and 'Decrement' capacity adjustment strategies
  - Read/Write provisioned capacity increased
    - when capacity utilisation > 75% or throttled events in the last minute > 25
    - by 3 + (0.7 * throttled events) units or by 30% + (0.7 * throttled events) of provisioned value or to 130% of the current consumed capacity, which ever is the greater
    - with hard min/max limits of 1 and 100 respectively
  - Read/Write provisioned capacity decreased
    - when capacity utilisation < 30% AND
    - when at least 60 minutes have passed since the last increment AND
    - when at least 60 minutes have passed since the last decrement AND
    - when the adjustment will be at least 5 units AND
    - when we are allowed to utilise 1 of our 4 AWS enforced decrements
    - to the consumed throughput value
    - with hard min/max limits of 1 and 100 respectively

## Strategy Settings

The strategy settings described above uses a simple schema which applies to both Read/Write and to
both the Increment/Decrement.  Using the options below many different strategies can be constructed:
- ReadCapacity.Min : (Optional) Define a minimum allowed capacity, otherwise 1
- ReadCapacity.Max : (Optional) Define a maximum allowed capacity, otherwise unlimited
- ReadCapacity.Increment : (Optional) Defined an increment strategy
- ReadCapacity.Increment.When : (Required) Define when capacity should be incremented
- ReadCapacity.Increment.When.ThrottledEventsPerMinuteIsAbove : (Optional) Define a threshold at which throttled events trigger an increment
- ReadCapacity.Increment.When.UtilisationIsAbovePercent : (Optional) Define a percentage utilisation upper threshold at which capacity is subject to recalculation
- ReadCapacity.Increment.When.UtilisationIsBelowPercent : (Optional) Define a percentage utilisation lower threshold at which capacity is subject to recalculation, possible but non sensical for increments however.
- ReadCapacity.Increment.When.AfterLastIncrementMinutes : (Optional) Define a grace period based off the previous increment in which capacity adjustments should not occur
- ReadCapacity.Increment.When.AfterLastDecrementMinutes : (Optional) Define a grace period based off the previous decrement in which capacity adjustments should not occur
- ReadCapacity.Increment.When.UnitAdjustmentGreaterThan : (Optional) Define a minimum unit adjustment so that only capacity adjustments of a certain size are allowed
- ReadCapacity.Increment.By : (Optional) Define a 'relative' value to change the capacity by
- ReadCapacity.Increment.By.ConsumedPercent : (Optional) Define a 'relative' percentage adjustment based on the current ConsumedCapacity
- ReadCapacity.Increment.By.ProvisionedPercent : (Optional) Define a 'relative' percentage adjustment based on the current ProvisionedCapacity
- ReadCapacity.Increment.By.Units : (Optional) Define a 'relative' unit adjustment
- ReadCapacity.Increment.By.ThrottledEventsWithMultiplier : (Optional) Define a 'multiple' of the throttled events in the last minute which are added to all other 'By' unit adjustments
- ReadCapacity.Increment.To : (Optional) Define an 'absolute' value to change the capacity to
- ReadCapacity.Increment.To.ConsumedPercent : (Optional) Define an 'absolute' percentage adjustment based on the current ConsumedCapacity
- ReadCapacity.Increment.To.ProvisionedPercent : (Optional) Define an 'absolute' percentage adjustment based on the current ProvisionedCapacity
- ReadCapacity.Increment.To.Units : (Optional) Define an 'absolute' unit adjustment

A sample of the strategy setting json is...
```javascript
{
  "ReadCapacity": {
    "Min": 1,
    "Max": 100,
    "Increment": {
      "When": {
        "UtilisationIsAbovePercent": 75,
        "ThrottledEventsPerMinuteIsAbove": 25
      },
      "By": {
        "Units": 3,
        "ProvisionedPercent": 30,
        "ThrottledEventsWithMultiplier": 0.7
      },
      "To": {
        "ConsumedPercent": 130
      }
    },
    "Decrement": {
      "When": {
        "UtilisationIsBelowPercent": 30,
        "AfterLastIncrementMinutes": 60,
        "AfterLastDecrementMinutes": 60,
        "UnitAdjustmentGreaterThan": 5
      },
      "To": {
        "ConsumedPercent": 100
      }
    }
  },
  "WriteCapacity": {
    "Min": 1,
    "Max": 100,
    "Increment": {
      "When": {
        "UtilisationIsAbovePercent": 75,
        "ThrottledEventsPerMinuteIsAbove": 25
      },
      "By": {
        "Units": 3,
        "ProvisionedPercent": 30,
        "ThrottledEventsWithMultiplier": 0.7
      },
      "To": {
        "ConsumedPercent": 130
      }
    },
    "Decrement": {
      "When": {
        "UtilisationIsBelowPercent": 30,
        "AfterLastIncrementMinutes": 60,
        "AfterLastDecrementMinutes": 60,
        "UnitAdjustmentGreaterThan": 5
      },
      "To": {
        "ConsumedPercent": 100
      }
    }
  }
}
```

## Advanced Configuration

This project takes a 'React' style code first approach over declarative configuration traditionally
used by other autoscaling community projects.  Rather than being limited to a structured
configuration file or even the 'strategy' settings above you have the option to extend the [ProvisionerBase.js](./src/provisioning/ProvisionerBase.js)
abstract base class for yourself and programmatically implement any desired logic.

The following three functions are all that is required to complete the provisioning functionality.  
As per the 'React' style, only actual updates to the ProvisionedCapacity will be sent to AWS.

```javascript
getDynamoDBRegion(): string {
  // Return the AWS region as a string
}

async getTableNamesAsync(): Promise<string[]> {
  // Return the table names to apply autoscaling to as a string array promise
}

async getTableUpdateAsync(
  tableDescription: TableDescription,
  tableConsumedCapacityDescription: TableConsumedCapacityDescription):
  Promise<?UpdateTableRequest> {
  // Given an AWS DynamoDB TableDescription and AWS CloudWatch ConsumedCapacity metrics
  // return an AWS DynamoDB UpdateTable request
}
```
[DescribeTable.ResponseSyntax](http://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DescribeTable.html#API_DescribeTable_ResponseSyntax)
[UpdateTable.RequestSyntax](http://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateTable.html#API_UpdateTable_RequestSyntax)

Flexibility is great, but implementing all the logic required for a robust autoscaling
strategy isn't something everyone wants to do.  Hence, the default 'Provisioner' builds upon the base
class in a layered approach.  The layers are as follows:
- [Provisioner.js](./src/Provisioner.js) concrete implementation which provides very robust autoscaling logic which can be manipulated with a 'strategy' settings json object
- [ProvisionerConfigurableBase.js](./src/provisioning/ProvisionerConfigurableBase.js) abstract base class which breaks out the 'getTableUpdateAsync' function into more manageable abstract methods
- [ProvisionerBase.js](./src/provisioning/ProvisionerBase.js) the root abstract base class which defines the minimum contract

## Throttled Events
Throttled events are now taken into account as part of the provisioning calculation.  A multiple of the events can be added to the existing calculation so that both large spikes in usage and hot key issues are both dealt with.

## Rate Limited Decrement

AWS only allows 4 table decrements in a calendar day.  To account for this we have included
an algorithm which segments the remaining time to midnight by the amount of decrements we have left.
This logic allows us to utilise each 4 decrements as efficiently as possible.  The increments on the
other hand are unlimited, so the algorithm follows a unique 'sawtooth' profile, dropping the
provisioned capacity all the way down to the consumed throughput rather than gradually.  Please see
[RateLimitedDecrement.js](./src/utils/RateLimitedDecrement.js) for full implementation.

## Capacity Calculation

As well as implementing the correct Provisioning logic it is also important to calculate the
ConsumedCapacity for the current point in time.  We have provided a default algorithm in
[CapacityCalculator.js](./src/CapacityCalculator.js) which should be good enough for most purposes
but it could be swapped out with perhaps an improved version.  The newer version could potentially
take a series of data points and plot a linear regression line through them for example.

## Dependencies

This project has the following main dependencies (n.b. all third party dependencies are compiled
into a single javascript file before being zipped and uploaded to lambda):
+ aws-sdk - Access to AWS services
+ dotenv - Environment variable configuration useful for lambda
+ measured - Statistics gathering

## Licensing

The source code is licensed under the MIT license found in the
[LICENSE](LICENSE) file in the root directory of this source tree.
