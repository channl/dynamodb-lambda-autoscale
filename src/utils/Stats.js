/* @flow */
import measured from 'measured';

export default class Stats {
  _stats: measured.MeasuredCollection;

  constructor(stats: measured.MeasuredCollection) {
    this._stats = stats;
  }

  reset() {
    for(let name in this._stats._metrics) {
      if ({}.hasOwnProperty.call(this._stats._metrics, name)) {
        let metric = this._stats._metrics[name];
        if (metric.unref) {
          metric.unref();
        }
      }
    }

    this._stats._metrics = {};
  }

  toJSON(): any {
    return this._stats.toJSON();
  }

  getSummaries() {
    let statsData = this._stats.toJSON();
    let statsSummary = Object
    .keys(statsData)
    .map(name => {
      let mean = this.to2Dec(statsData[name].histogram.mean);
      let count = statsData[name].meter.count;
      return {name, mean, count};
    });

    statsSummary.sort((a, b) => {
      if (a.mean < b.mean) {
        return 1;
      }
      if (a.mean > b.mean) {
        return -1;
      }
      return 0;
    });

    let nameLen = Math.max.apply(Math, statsSummary.map(i => i.name.length));
    let statsAsStrings = statsSummary.map(s =>
      this.padRight(s.name, nameLen + 2) +
      this.padRight(s.mean + 'ms', 10) +
      ' ' +
      s.count);

    return statsAsStrings;
  }

  padRight(value: string, length: number) {
    return value + Array(length - value.length).join(' ');
  }

  padLeft(value: string, paddingValue: string) {
    return String(paddingValue + value).slice(-paddingValue.length);
  }

  to2Dec(value: number) {
    return parseFloat(parseFloat(Math.round(value * 100) / 100).toFixed(2));
  }
}
