/* @flow */
import invariant from 'invariant';
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

  // $FlowIgnore
  @Instrument.timer()
  async getMetricStatisticsAsync(params: GetMetricStatisticsRequest)
    : Promise<GetMetricStatisticsResponse> {
    invariant(params != null, 'Parameter \'params\' is not set');
    return await this._cw.getMetricStatistics(params).promise();
  }
}
