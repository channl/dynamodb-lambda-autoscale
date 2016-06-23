/* @flow */
import AWS from 'aws-sdk-promise';
import { json, stats, warning, invariant } from '../Global';
import type {
  CloudWatchOptions,
  GetMetricStatisticsRequest,
  GetMetricStatisticsResponse,
} from 'aws-sdk-promise';

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

  async getMetricStatisticsAsync(params: GetMetricStatisticsRequest)
    : Promise<GetMetricStatisticsResponse> {
    let sw = stats.timer('CloudWatch.getMetricStatisticsAsync').start();
    try {
      invariant(params != null, 'Parameter \'params\' is not set');
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
