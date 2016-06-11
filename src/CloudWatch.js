/* @flow */
import AWS from 'aws-sdk-promise';
import { json, stats, warning, invariant } from './Global';
import type {
  CloudWatchOptions,
  GetMetricStatisticsRequest,
  GetMetricStatisticsResponse,
} from './FlowTypes';

export default class CloudWatch {
  _cw: AWS.CloudWatch;

  constructor(cloudWatchOptions: CloudWatchOptions) {
    invariant(typeof cloudWatchOptions !== 'undefined',
      'Parameter \'cloudWatchOptions\' is not set');
    this._cw = new AWS.CloudWatch(cloudWatchOptions);
  }

  async getMetricStatisticsAsync(params: GetMetricStatisticsRequest)
    : Promise<GetMetricStatisticsResponse> {
    let sw = stats.timer('CloudWatch.getMetricStatisticsAsync').start();
    try {
      invariant(typeof params !== 'undefined',
        'Parameter \'params\' is not set');
      let res = await this._cw.getMetricStatistics(params).promise();
      return res.data;
    } catch (ex) {
      warning(JSON.stringify({
        class: 'CloudWatch',
        function: 'getMetricStatisticsAsync',
        params
      }, null, json.padding));
      throw ex;
    } finally {
      sw.end();
    }
  }
}
