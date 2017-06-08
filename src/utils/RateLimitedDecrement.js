/* @flow */
import { invariant } from '../Global';
import type {
  TableProvisionedAndConsumedThroughput,
  AdjustmentContext
} from '../flow/FlowTypes';

export default class RateLimitedDecrement {

  static isDecrementAllowed(
    data: TableProvisionedAndConsumedThroughput,
    adjustmentContext: AdjustmentContext,
    calcNewValueFunc: (data: TableProvisionedAndConsumedThroughput) => number) {

    invariant(data != null, 'Parameter \'data\' is not set');
    invariant(adjustmentContext != null, 'Parameter \'adjustmentContext\' is not set');
    invariant(calcNewValueFunc != null, 'Parameter \'calcNewValueFunc\' is not set');

    if (this.getNextAllowedDecrementDate(data, adjustmentContext) > this.getNowDate()) {
      // Disallow if we havent crossed one of four time barriers
      return false;
    }

    let adjustment = Math.abs(adjustmentContext.ProvisionedValue) -
      Math.abs(calcNewValueFunc(data));

    if (adjustmentContext.CapacityAdjustmentConfig != null &&
      adjustmentContext.CapacityAdjustmentConfig.When.UnitAdjustmentGreaterThan != null &&
      adjustment <= adjustmentContext.CapacityAdjustmentConfig.When.UnitAdjustmentGreaterThan &&
      this.getNowDate().valueOf() <
      this.getLastAllowedDecrementDate().valueOf()) {
      // Disallow if the adjustment is very small.
      // However, if we have crossed the last time
      // barrier of the day then we might as well allow it.
      return false;
    }

    return true;
  }

  static getNextAllowedDecrementDate(
    data: TableProvisionedAndConsumedThroughput,
    adjustmentContext: AdjustmentContext) {

    // Check if we have already had all the decreases we are allowed today
    if (data.ProvisionedThroughput.NumberOfDecreasesToday >= 4) {
      return this.getTomorrowDate();
    }

    // Get the last decrease or start of day
    let lastDecrease = this.parseDate(data.ProvisionedThroughput.LastDecreaseDateTime);
    let lastDecrementDate = this.getLastDecrementDate(lastDecrease);

    // Get the next allowed decrement
    let lastAllowedDecrementDate = this.getLastAllowedDecrementDate();
    let periodMs = lastAllowedDecrementDate.valueOf() - lastDecrementDate.valueOf();
    let periodMs2 = periodMs / (5 - data.ProvisionedThroughput.NumberOfDecreasesToday);
    let nextDecrementDate = this.getLastDecrementDate(lastDecrease);
    nextDecrementDate.setMilliseconds(nextDecrementDate.getMilliseconds() + periodMs2);

    // Handle grace periods
    let withIncrementGracePeriod = this.parseDate(data.ProvisionedThroughput.LastIncreaseDateTime);

    if (adjustmentContext.CapacityAdjustmentConfig != null &&
      adjustmentContext.CapacityAdjustmentConfig.When.AfterLastIncrementMinutes != null) {
      let incMins = adjustmentContext.CapacityAdjustmentConfig.When.AfterLastIncrementMinutes;
      withIncrementGracePeriod.setMinutes(withIncrementGracePeriod.getMinutes() + incMins);
    }

    let withDecrementGracePeriod = this.parseDate(data.ProvisionedThroughput.LastDecreaseDateTime);

    if (adjustmentContext.CapacityAdjustmentConfig != null &&
      adjustmentContext.CapacityAdjustmentConfig.When.AfterLastDecrementMinutes != null) {
      let decMins = adjustmentContext.CapacityAdjustmentConfig.When.AfterLastDecrementMinutes;
      withDecrementGracePeriod.setMinutes(withDecrementGracePeriod.getMinutes() + decMins);
    }

    let result = new Date(Math.max(
      nextDecrementDate, withIncrementGracePeriod, withDecrementGracePeriod));

    return result;
  }

  static getNowDate() {
    return new Date(Date.now());
  }

  static getTodayDate() {
    let value = this.getNowDate();
    value.setHours(0, 0, 0, 0);
    return value;
  }

  static getTomorrowDate() {
    let value = this.getTodayDate();
    value.setDate(value.getDate() + 1);
    return value;
  }

  static getLastAllowedDecrementDate() {
    let value = this.getTodayDate();
    value.setHours(23, 30, 0, 0);
    return value;
  }

  static getLastDecrementDate(lastDecrease) {
    let today = this.getTodayDate();
    return lastDecrease < today ? today : new Date(lastDecrease.valueOf());
  }

  static parseDate(value) {
    // eslint-disable-next-line eqeqeq
    if (typeof value === 'undefined' || value == null) {
      return new Date(-8640000000000000);
    }

    return new Date(Date.parse(value));
  }
}
