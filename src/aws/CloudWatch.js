/* @flow */
import invariant from 'invariant';
import warning from 'warning';
import Instrument from '../logging/Instrument';
import AWS from 'aws-sdk';
import type {
  CloudWatchOptions,
  GetMetricStatisticsRequest,
  GetMetricStatisticsResponse,
} from 'aws-sdk';

export default class CloudWatch {
  _cw: AWS.CloudWatch;

  constructor(cloudWatchOptions: CloudWatchOptions) {
    invariant(cloudWatchOptions != null, 'Parameter \'cloudWatchOptions\' is not set');
    this._cw = new AWS.CloudWatch(cloudWatchOptions);
  }

  static create(region: string): CloudWatch {
    var options = {
      region,
      apiVersion: '2010-08-01',
      httpOptions: { timeout: 5000 }
    };

    return new CloudWatch(options);
  }

  // $FlowIgnore
  @Instrument.timer()
  async getMetricStatisticsAsync(params: GetMetricStatisticsRequest)
    : Promise<GetMetricStatisticsResponse> {
    invariant(params != null, 'Parameter \'params\' is not set');
    return await this._cw.getMetricStatistics(params).promise();
  }
}
