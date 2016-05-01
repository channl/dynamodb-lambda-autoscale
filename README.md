dynamodb-lambda-autoscale
=========================
Autoscale AWS DynamoDB using an AWS Lambda function

DynamoDB does not currently have an official way of autoscaling the capacity throughput for reads and writes.

Features
--------

- 5 minute setup process
- Serverless design
- Flexible code over configuration style
- Autoscale table and global secondary indexes
- Autoscale multiple tables
- Optimised performance using concurrent queries
- Statistics via 'measured'
- AWS credential configuration via 'dotenv'
- Optimised lambda package via 'webpack'
- ES7 code

Setup
-----

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

License
-------

The MIT License (MIT)

Copyright (c) 2016 for dynamodb-lambda-autoscale

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
