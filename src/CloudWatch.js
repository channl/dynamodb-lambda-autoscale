import AWS from 'aws-sdk-promise';
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
    logger.debug('CloudWatch.getMetricStatisticsAsync');
    let sw = stats.timer('CloudWatch.getMetricStatisticsAsync').start()
    try {
      let res = await this._cw.getMetricStatistics(params).promise();
      return res.data;
    } catch (ex) {
      logger.warn('CloudWatch.getMetricStatisticsAsync failed', JSON.stringify({params}));
      throw ex;
    } finally {
      sw.end();
    }
  }
}
