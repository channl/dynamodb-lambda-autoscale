# dynamodb-lambda-autoscale
**Autoscale AWS DynamoDB using an AWS Lambda function**

+ 5 minute setup process
+ Serverless design
+ Flexible code over configuration style
+ Autoscale table and global secondary indexes
+ Autoscale multiple tables
+ Optimised performance using concurrent queries
+ Statistics via 'measured'
+ AWS credential configuration via 'dotenv'
+ Optimised lambda package via 'webpack'
+ ES7 code

## Getting started

1. Build and package the code
  1. Fork the repo
  2. Clone your fork
  3. Create a new file in the root folder called 'config.env.production'
  4. Put your AWS credentials into the file in the following format
  ~~~~
  AWS_ACCESS_KEY_ID="###################"
  AWS_SECRET_ACCESS_KEY="###############"
  ~~~~
  3. Run 'npm install'
  4. Run 'npm run build'
  5. Verify this has created a 'dist.zip' file
  6. Optionally, run a local test by running 'npm run start'

## Running on AWS Lambda

1. Follow the steps in 'Running locally'
2. Create an AWS Policy and Role
  1. Create a policy called 'DynamoDBLambdaAutoscale'
  2. Use the following content to give access to dynamoDB, cloudwatch and lambda logging
  ~~~~
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
  ~~~~
  3. Create a role called 'DynamoDBLambdaAutoscale'
  4. Attach the newly created policy to the role
3. Create a AWS Lambda function
  1. Skip the pre defined functions step
  2. Set the name to 'DynamoDBLambdaAutoscale'
  3. Set the runtime to 'Node.js 4.3'
  4. Select upload a zip file and select 'dist.zip' which you created earlier
  5. Set the handler to 'index.handler'
  6. Set the Role to 'DynamoDBLambdaAutoscale'
  7. Set the Memory to the highest value to give the best performance
  8. Set the Timeout to 5 seconds (higher possibly depending on the amount of tables you have)
  9. Once the function is created, attach a 'scheduled event' event source and make it run every minute

## Configuration

The default setup of the configuration is to apply autoscaling to all tables,
allowing for a no touch quick setup.

dynamodb-lambda-autoscale takes a different approach to autoscaling
configuration compared to other community projects.  Rather than making changes
to a config file dynamodb-lambda-autoscale provides a function 'getTableUpdate'
which must be implemented.


```javascript
{
  connection: {
    dynamoDB: { apiVersion: '2012-08-10', region: 'us-east-1' },
    cloudWatch: { apiVersion: '2010-08-01', region: 'us-east-1' }
  },
  getTableUpdate: (description, consumedCapacityDescription) => {
    // The 'description' parameter is JSON in the following format
    <http://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DescribeTable.html#API_DescribeTable_ResponseSyntax>

    // The 'consumedCapacityDescription' follows the same format but details
    // the consumed capacity found via the cloudwatch api

    // The return type is either null for no update or JSON in the
    // following format
    <http://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateTable.html#API_UpdateTable_ResponseSyntax>
  }
};
```

The function is given the information such as the table name, current table
provisioned throughput and the consumed throughput for the past minute.
Table updates will only be sent to AWS if the values are different for the
current, this approach follows the popular code first pattern used in React.

In most cases the default 'ConfigurableProvisioner' supplied will provide
enough functionality out of box such that additional coding is not required.
The default provisioner provides the following features.

- Separate 'Read' and 'Write' capacity adjustment
- Separate 'Increment' and 'Decrement' capacity adjustment
- Read/Write provisioned capacity increased
  - if capacity utilisation > 90%
  - by either 100% or 3 units, which ever is the greater
  - with hard min/max limits of 1 and 10 respectively
- Read/Write provisioned capacity decreased
  - if capacity utilisation < 30% AND
  - if at least 60 minutes have passed since the last increment AND
  - if at least 60 minutes have passed since the last decrement AND
  - if the adjustment will be at least 3 units AND
  - if we are allowed to utilise 1 of our 4 AWS enforced decrements
  - to the consumed throughput value
  - with a hard min limit of 1

As AWS only allows 4 table decrements in a calendar day we have an intelligent
algorithm which segments the remaining time to midnight by the amount of
decrements we have left.  This logic allows us to utilise each 4 decrements
efficiently.  The increments are unlimited so the algorithm follows a unique
'sawtooth' profile, dropping the provisioned throughput all the way down to
the consumed throughput rather than gradually.  Please see
[RateLimitedDecrement.js](./src/RateLimitedDecrement.js) for full
implementation.

## Dependencies

dynamodb-lambda-autoscale has the following main dependencies:
+ aws-sdk - Access to AWS services
+ winston - Logging
+ dotenv - Environment variable configuration useful for lambda
+ measured - Statistics gathering

## Licensing

The source code is licensed under the MIT license found in the
[LICENSE](LICENSE) file in the root directory of this source tree.
