import AWS from 'aws-sdk';
import Global from './global';
const {
  stats,
  logger
} = Global;

export default class CloudWatch {
  constructor(cloudWatchOptions) {
    this._cw = new AWS.CloudWatch(cloudWatchOptions);
  }

  async getMetricStatisticsAsync(params) {
    let sw = stats.timer('CloudWatch.getMetricStatisticsAsync').start()
    try {
      return await this._cw.getMetricStatistics(params).promise();
    }
    finally {
      sw.end();
    }
  }
}
