/* @flow */
import { log } from '../Global';
import type {
  AdjustmentContext,
  AdjustmentData,
} from '../flow/FlowTypes';

export default class ConfigLogging {
  static isAdjustmentRequiredLog(
    adjustmentContext: AdjustmentContext,
    adjustmentData: AdjustmentData,
  ) {

    let logMessage = typeof adjustmentContext.IndexName === 'undefined' ?
      adjustmentContext.TableName : adjustmentContext.TableName + '.' + adjustmentContext.IndexName;
    logMessage += ' is consuming ' + adjustmentContext.ConsumedValue + ' of ' +
      adjustmentContext.ProvisionedValue + ' (' + adjustmentContext.UtilisationPercent +
      '%) ' + adjustmentContext.CapacityType + ' capacity units';

    if (adjustmentContext.CapacityConfig.Max != null && adjustmentData.isAboveMax) {
      logMessage += ' and is above max allowed ' + adjustmentContext.CapacityConfig.Max + ' units';
    }

    if (adjustmentContext.CapacityAdjustmentConfig != null &&
      adjustmentContext.CapacityAdjustmentConfig.When.UtilisationIsAbovePercent != null &&
      adjustmentData.isAboveThreshold && !adjustmentData.isAboveMax) {
      logMessage += ' and is above maximum threshold of ' +
        adjustmentContext.CapacityAdjustmentConfig.When.UtilisationIsAbovePercent + '%';
    }

    if (adjustmentContext.CapacityConfig.Min != null && adjustmentData.isBelowMin) {
      logMessage += ' and is below the min allowed ' + adjustmentContext.CapacityConfig.Min +
        ' units';
    }

    if (adjustmentContext.CapacityAdjustmentConfig != null &&
      adjustmentContext.CapacityAdjustmentConfig.When.UtilisationIsBelowPercent != null &&
      adjustmentData.isBelowThreshold && !adjustmentData.isBelowMin) {
      logMessage += ' and is below minimum threshold of ' +
        adjustmentContext.CapacityAdjustmentConfig.When.UtilisationIsBelowPercent + '%';
    }

    if (adjustmentContext.CapacityAdjustmentConfig != null &&
      adjustmentContext.CapacityAdjustmentConfig.When.ThrottledEventsPerMinuteIsAbove != null &&
      adjustmentData.isAboveThrottledEventThreshold) {
      logMessage += ' and throttled events per minute is above ' +
        adjustmentContext.CapacityAdjustmentConfig.When.ThrottledEventsPerMinuteIsAbove + ' events';
    }

    if (adjustmentData.isAdjustmentWanted) {
      logMessage += adjustmentContext.AdjustmentType === 'increment' ?
        ' so an increment is WANTED' : ' so a decrement is WANTED';
      if (adjustmentData.isAdjustmentAllowed) {
        logMessage += ' and is ALLOWED';
      } else if (!adjustmentData.isAfterLastDecreaseGracePeriod) {
        logMessage += ' but is DISALLOWED due to \'AfterLastDecrementMinutes\' grace period';
      } else if (!adjustmentData.isAfterLastIncreaseGracePeriod) {
        logMessage += ' but is DISALLOWED due to \'AfterLastIncreaseMinutes\' grace period';
      } else {
        logMessage += ' but is DISALLOWED';
      }
    } else {
      logMessage += adjustmentContext.AdjustmentType === 'increment' ?
        ' so an increment is not required' : ' so a decrement is not required';
    }

    log(logMessage);
  }
}
