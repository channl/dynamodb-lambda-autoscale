/* @flow */
import Metrics from '../metrics/Metrics';

export default class Instrument {
  static timer() {
    return function(target: Object, name: string, descriptor: any) {
      let method = descriptor.value;
      descriptor.value = function(...args) {
        let sw = Metrics.stats.timer(`${target.constructor.name}.${name}`).start();
        let promOrRes = null;
        try {
          promOrRes = method.apply(this, args);
        } finally {
          // Is not a promise
          if (!(promOrRes instanceof Promise)) {
            sw.end();
            return promOrRes;
          }
        }

        // Is a promise
        return promOrRes
          .catch(err => {
            sw.end();
            throw err;
          })
          .then(result => {
            sw.end();
            return result;
          });
      };
      return descriptor;
    };
  }
}
