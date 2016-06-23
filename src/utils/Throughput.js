/* @flow */
/* eslint-disable max-len */
import { json, warning, invariant } from '../Global';
import type { TableDescription } from 'aws-sdk-promise';
import type { TableProvisionedAndConsumedThroughput, AdjustmentContext } from '../flow/FlowTypes';

export default class Throughput {

  static getReadCapacityUtilisationPercent(data: TableProvisionedAndConsumedThroughput) {
    invariant(data != null, 'Parameter \'data\' is not set');

    return (
      data.ConsumedThroughput.ReadCapacityUnits /
      data.ProvisionedThroughput.ReadCapacityUnits) * 100;
  }

  static getWriteCapacityUtilisationPercent(data: TableProvisionedAndConsumedThroughput) {
    invariant(data != null, 'Parameter \'data\' is not set');

    return (
      data.ConsumedThroughput.WriteCapacityUnits /
      data.ProvisionedThroughput.WriteCapacityUnits) * 100;
  }

  static getAdjustedCapacityUnits(adjustmentContext: AdjustmentContext): number {
    invariant(adjustmentContext != null, 'Parameter \'adjustmentContext\' is not set');

    // If the provisioned units is less than minimum then simply return the minimum allowed
    if (adjustmentContext.CapacityConfig.Min != null &&
      adjustmentContext.ProvisionedValue < adjustmentContext.CapacityConfig.Min) {
      return adjustmentContext.CapacityConfig.Min;
    }

    // If the provisioned units is greater than maximum then simply return the maximum allowed
    if (adjustmentContext.CapacityConfig.Max != null &&
      adjustmentContext.ProvisionedValue > adjustmentContext.CapacityConfig.Max) {
      return adjustmentContext.CapacityConfig.Max;
    }

    let direction = adjustmentContext.AdjustmentType === 'increment' ? 1 : -1;

    // Increment 'by' percentage of provisioned
    let byP = (adjustmentContext.CapacityAdjustmentConfig.By != null && adjustmentContext.CapacityAdjustmentConfig.By.ProvisionedPercent != null) ?
      adjustmentContext.ProvisionedValue + (((adjustmentContext.ProvisionedValue / 100) * adjustmentContext.CapacityAdjustmentConfig.By.ProvisionedPercent) * direction) :
      adjustmentContext.ProvisionedValue;

    // Increment 'by' percentage of consumed
    let byC = (adjustmentContext.CapacityAdjustmentConfig.By != null && adjustmentContext.CapacityAdjustmentConfig.By.ConsumedPercent != null) ?
      adjustmentContext.ProvisionedValue + (((adjustmentContext.ConsumedValue / 100) * adjustmentContext.CapacityAdjustmentConfig.By.ConsumedPercent) * direction) :
      adjustmentContext.ProvisionedValue;

    // Increment 'by' unit value
    let byU = (adjustmentContext.CapacityAdjustmentConfig.By != null && adjustmentContext.CapacityAdjustmentConfig.By.Units != null) ?
      adjustmentContext.ProvisionedValue + (adjustmentContext.CapacityAdjustmentConfig.By.Units * direction) :
      adjustmentContext.ProvisionedValue;

    // Increment 'to' percentage of provisioned
    let toP = (adjustmentContext.CapacityAdjustmentConfig.To != null && adjustmentContext.CapacityAdjustmentConfig.To.ProvisionedPercent != null) ?
      (adjustmentContext.ProvisionedValue / 100) * adjustmentContext.CapacityAdjustmentConfig.To.ProvisionedPercent :
      adjustmentContext.ProvisionedValue;

    // Increment 'to' percentage of consumed
    let toC = (adjustmentContext.CapacityAdjustmentConfig.To != null && adjustmentContext.CapacityAdjustmentConfig.To.ConsumedPercent != null) ?
      (adjustmentContext.ConsumedValue / 100) * adjustmentContext.CapacityAdjustmentConfig.To.ConsumedPercent :
      adjustmentContext.ProvisionedValue;

    // Increment 'to' unit value
    let toU = (adjustmentContext.CapacityAdjustmentConfig.To != null && adjustmentContext.CapacityAdjustmentConfig.To.units != null) ?
      adjustmentContext.CapacityAdjustmentConfig.To.units :
      adjustmentContext.ProvisionedValue;

    // Select the greatest calculated increment
    let newValue = adjustmentContext.AdjustmentType === 'increment' ?
      Math.max(byP, byC, byU, toP, toC, toU) :
      Math.min(byP, byC, byU, toP, toC, toU);

    // Limit to 'max' if it is specified
    if (adjustmentContext.CapacityConfig.Max != null) {
      newValue = Math.min(newValue, adjustmentContext.CapacityConfig.Max);
    }

    // Limit to 'min' if it is specified
    if (adjustmentContext.CapacityConfig.Min != null) {
      newValue = Math.max(newValue, adjustmentContext.CapacityConfig.Min, 1);
    }

    // Ensure we return a whole number
    return Math.round(newValue);
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
