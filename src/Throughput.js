import { invariant } from '../src/Global';

export default class Throughput {
  static getReadCapacityUtilisationPercent(data) {
    invariant(typeof data !== 'undefined', 'Parameter \'data\' is not set');

    return (
      data.ConsumedThroughput.ReadCapacityUnits /
        data.ProvisionedThroughput.ReadCapacityUnits) * 100;
  }

  static getPercentAdjustedReadCapacityUnits(
    data, adjustmentPercent, adjustmentUnits, max, min) {

    invariant(typeof data !== 'undefined', 'Parameter \'data\' is not set');
    invariant(typeof adjustmentPercent !== 'undefined',
      'Parameter \'adjustmentPercent\' is not set');
    invariant(typeof adjustmentUnits !== 'undefined',
      'Parameter \'adjustmentUnits\' is not set');
    invariant(typeof max !== 'undefined', 'Parameter \'max\' is not set');
    invariant(typeof min !== 'undefined', 'Parameter \'min\' is not set');

    let units = Math.round(
      data.ProvisionedThroughput.ReadCapacityUnits * (adjustmentPercent / 100));
    units = Math.max(units, adjustmentUnits);
    let newValue = data.ProvisionedThroughput.ReadCapacityUnits + units;
    return Math.max(Math.min(newValue, max), min);
  }

  static getWriteCapacityUtilisationPercent(data) {
    invariant(typeof data !== 'undefined', 'Parameter \'data\' is not set');

    return (
      data.ConsumedThroughput.WriteCapacityUnits /
      data.ProvisionedThroughput.WriteCapacityUnits) * 100;
  }

  static getPercentAdjustedWriteCapacityUnits(
    data, adjustmentPercent, adjustmentUnits, max, min) {

    invariant(typeof data !== 'undefined', 'Parameter \'data\' is not set');
    invariant(typeof adjustmentPercent !== 'undefined',
      'Parameter \'adjustmentPercent\' is not set');
    invariant(typeof adjustmentUnits !== 'undefined',
      'Parameter \'adjustmentUnits\' is not set');
    invariant(typeof max !== 'undefined', 'Parameter \'max\' is not set');
    invariant(typeof min !== 'undefined', 'Parameter \'min\' is not set');

    let units = Math.round(
      data.ProvisionedThroughput.WriteCapacityUnits *
      (adjustmentPercent / 100));

    units = Math.max(units, adjustmentUnits);
    let newValue = data.ProvisionedThroughput.WriteCapacityUnits + units;
    return Math.max(Math.min(newValue, max), min);
  }
}
