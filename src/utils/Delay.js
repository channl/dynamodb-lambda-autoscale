/* @flow */
import invariant from 'invariant';

export default class Delay {
  static delayAsync(ms: number): Promise<void> {
    invariant(typeof ms === 'number', 'Argument ms is not a number');

    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }
}
