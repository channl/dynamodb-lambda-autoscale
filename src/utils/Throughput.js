/* @flow */
/* eslint-disable max-len */
import { json, warning, invariant } from '../Global';
import type { TableDescription, DynamoDBProvisionedThroughput } from 'aws-sdk';
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

    // Increment 'by' throttled events and configured mutliplier, increments only!
    let byTE = (direction === 1 && adjustmentContext.CapacityAdjustmentConfig != null && adjustmentContext.CapacityAdjustmentConfig.By != null && adjustmentContext.CapacityAdjustmentConfig.By.ThrottledEventsWithMultiplier != null) ?
      (adjustmentContext.ThrottledEvents * adjustmentContext.CapacityAdjustmentConfig.By.ThrottledEventsWithMultiplier) :
      0;
    let byTEVal = adjustmentContext.ProvisionedValue + byTE;

    // Increment 'by' percentage of provisioned
    let byP = (adjustmentContext.CapacityAdjustmentConfig != null && adjustmentContext.CapacityAdjustmentConfig.By != null && adjustmentContext.CapacityAdjustmentConfig.By.ProvisionedPercent != null) ?
      (((adjustmentContext.ProvisionedValue / 100) * adjustmentContext.CapacityAdjustmentConfig.By.ProvisionedPercent) * direction) :
      0;
    let byPVal = adjustmentContext.ProvisionedValue + byP + byTE;

    // Increment 'by' percentage of consumed
    let byC = (adjustmentContext.CapacityAdjustmentConfig != null && adjustmentContext.CapacityAdjustmentConfig.By != null && adjustmentContext.CapacityAdjustmentConfig.By.ConsumedPercent != null) ?
      (((adjustmentContext.ConsumedValue / 100) * adjustmentContext.CapacityAdjustmentConfig.By.ConsumedPercent) * direction) :
      0;
    let byCVal = adjustmentContext.ProvisionedValue + byC + byTE;

    // Increment 'by' unit value
    let byU = (adjustmentContext.CapacityAdjustmentConfig != null && adjustmentContext.CapacityAdjustmentConfig.By != null && adjustmentContext.CapacityAdjustmentConfig.By.Units != null) ?
      (adjustmentContext.CapacityAdjustmentConfig.By.Units * direction) :
      0;
    let byUVal = adjustmentContext.ProvisionedValue + byU + byTE;

    // Increment 'to' percentage of provisioned
    let toP = (adjustmentContext.CapacityAdjustmentConfig != null && adjustmentContext.CapacityAdjustmentConfig.To != null && adjustmentContext.CapacityAdjustmentConfig.To.ProvisionedPercent != null) ?
      (adjustmentContext.ProvisionedValue / 100) * adjustmentContext.CapacityAdjustmentConfig.To.ProvisionedPercent :
      adjustmentContext.ProvisionedValue;

    // Increment 'to' percentage of consumed
    let toC = (adjustmentContext.CapacityAdjustmentConfig != null && adjustmentContext.CapacityAdjustmentConfig.To != null && adjustmentContext.CapacityAdjustmentConfig.To.ConsumedPercent != null) ?
      (adjustmentContext.ConsumedValue / 100) * adjustmentContext.CapacityAdjustmentConfig.To.ConsumedPercent :
      adjustmentContext.ProvisionedValue;

    // Increment 'to' unit value
    let toU = (adjustmentContext.CapacityAdjustmentConfig != null && adjustmentContext.CapacityAdjustmentConfig.To != null && adjustmentContext.CapacityAdjustmentConfig.To.Units != null) ?
      adjustmentContext.CapacityAdjustmentConfig.To.Units :
      adjustmentContext.ProvisionedValue;

    // Select the greatest calculated increment
    let newValue = adjustmentContext.AdjustmentType === 'increment' ?
      Math.max(byPVal, byCVal, byUVal, byTEVal, toP, toC, toU) :
      Math.min(byPVal, byCVal, byUVal, byTEVal, toP, toC, toU);

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

  static getTotalTableProvisionedThroughput(params: TableDescription)
    : DynamoDBProvisionedThroughput {
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
