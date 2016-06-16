/* @flow */
import { json, warning, invariant } from './Global';
import type { TableDescription } from 'aws-sdk-promise';

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

    if (data.ProvisionedThroughput.ReadCapacityUnits < min) {
      return Math.round(min);
    }

    let units = Math.round(
      data.ProvisionedThroughput.ReadCapacityUnits * (adjustmentPercent / 100));
    units = Math.max(units, adjustmentUnits);
    let newValue = data.ProvisionedThroughput.ReadCapacityUnits + units;
    return Math.round(Math.max(Math.min(newValue, max), min));
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
    invariant(typeof adjustmentUnits !== 'undefined', 'Parameter \'adjustmentUnits\' is not set');
    invariant(typeof max !== 'undefined', 'Parameter \'max\' is not set');
    invariant(typeof min !== 'undefined', 'Parameter \'min\' is not set');

    if (data.ProvisionedThroughput.WriteCapacityUnits < min) {
      return Math.round(min);
    }

    let units = Math.round(data.ProvisionedThroughput.WriteCapacityUnits *
      (adjustmentPercent / 100));

    units = Math.max(units, adjustmentUnits);
    let newValue = data.ProvisionedThroughput.WriteCapacityUnits + units;
    return Math.round(Math.max(Math.min(newValue, max), min));
  }

  static getTotalTableProvisionedThroughput(params: TableDescription) {
    try {
      invariant(typeof params !== 'undefined', 'Parameter \'params\' is not set');

      let ReadCapacityUnits = params.ProvisionedThroughput.ReadCapacityUnits;
      let WriteCapacityUnits = params.ProvisionedThroughput.WriteCapacityUnits;

      if (params.GlobalSecondaryIndexes) {
        ReadCapacityUnits += params.GlobalSecondaryIndexes
          .reduce((prev, curr) =>
            prev + curr.ProvisionedThroughput.ReadCapacityUnits, 0);

        WriteCapacityUnits += params.GlobalSecondaryIndexes
          .reduce((prev, curr) =>
            prev + curr.ProvisionedThroughput.WriteCapacityUnits, 0);
      }

      return {
        ReadCapacityUnits,
        WriteCapacityUnits
      };
    } catch (ex) {
      warning(JSON.stringify({
        class: 'Throughput',
        function: 'getTotalTableProvisionedThroughput',
        params
      }, null, json.padding));
      throw ex;
    }
  }
}
