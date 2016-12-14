/* @flow */
/* eslint-disable max-len */
import ProvisionerConfigurableBase from './provisioning/ProvisionerConfigurableBase';
import RateLimitedDecrement from './utils/RateLimitedDecrement';
import Throughput from './utils/Throughput';
import ProvisionerLogging from './provisioning/ProvisionerLogging';
import { Region } from './configuration/Region';
import DefaultProvisioner from './configuration/DefaultProvisioner';
import { invariant } from './Global';
import type { TableProvisionedAndConsumedThroughput, ProvisionerConfig, AdjustmentContext } from './flow/FlowTypes';

export default class Provisioner extends ProvisionerConfigurableBase {

  // Get the region
  getDynamoDBRegion(): string {
    return Region;
  }

  // Gets the list of tables which we want to autoscale
  async getTableNamesAsync(): Promise<string[]> {

    // Option 1 - All tables (Default)
    return await this.db.listAllTableNamesAsync();

    // Option 2 - Hardcoded list of tables
    // return ['Table1', 'Table2', 'Table3'];

    // Option 3 - DynamoDB / S3 configured list of tables
    // return await ...;
  }

  // Gets the json settings which control how the specifed table will be autoscaled
  // eslint-disable-next-line no-unused-vars
  getTableConfig(data: TableProvisionedAndConsumedThroughput): ProvisionerConfig {

    // Option 1 - Default settings for all tables
    return DefaultProvisioner;

    // Option 2 - Bespoke table specific settings
    // return data.TableName === 'Table1' ? Climbing : Default;

    // Option 3 - DynamoDB / S3 sourced table specific settings
    // return await ...;
  }

  isReadCapacityIncrementRequired(data: TableProvisionedAndConsumedThroughput): boolean {
    invariant(data != null, 'Parameter \'data\' is not set');

    let config = this.getTableConfig(data);
    let adjustmentContext = this.getReadCapacityIncrementAdjustmentContext(data, config);
    return this.isCapacityAdjustmentRequired(data, adjustmentContext);
  }

  calculateIncrementedReadCapacityValue(data: TableProvisionedAndConsumedThroughput): number {
    invariant(data != null, 'Parameter \'data\' is not set');

    let config = this.getTableConfig(data);
    let adjustmentContext = this.getReadCapacityIncrementAdjustmentContext(data, config);
    return Throughput.getAdjustedCapacityUnits(adjustmentContext);
  }

  isReadCapacityDecrementRequired(data: TableProvisionedAndConsumedThroughput): boolean {
    invariant(data != null, 'Parameter \'data\' is not set');

    let config = this.getTableConfig(data);
    let adjustmentContext = this.getReadCapacityDecrementAdjustmentContext(data, config);
    return this.isCapacityAdjustmentRequired(data, adjustmentContext);
  }

  calculateDecrementedReadCapacityValue(data: TableProvisionedAndConsumedThroughput): number {
    invariant(data != null, 'Parameter \'data\' is not set');

    let config = this.getTableConfig(data);
    let adjustmentContext = this.getReadCapacityDecrementAdjustmentContext(data, config);
    return Throughput.getAdjustedCapacityUnits(adjustmentContext);
  }

  isWriteCapacityIncrementRequired(data: TableProvisionedAndConsumedThroughput): boolean {
    invariant(data != null, 'Parameter \'data\' is not set');

    let config = this.getTableConfig(data);
    let adjustmentContext = this.getWriteCapacityIncrementAdjustmentContext(data, config);
    return this.isCapacityAdjustmentRequired(data, adjustmentContext);
  }

  calculateIncrementedWriteCapacityValue(data: TableProvisionedAndConsumedThroughput): number {
    invariant(data != null, 'Parameter \'data\' is not set');

    let config = this.getTableConfig(data);
    let adjustmentContext = this.getWriteCapacityIncrementAdjustmentContext(data, config);
    return Throughput.getAdjustedCapacityUnits(adjustmentContext);
  }

  isWriteCapacityDecrementRequired(data: TableProvisionedAndConsumedThroughput): boolean {
    invariant(data != null, 'Parameter \'data\' is not set');

    let config = this.getTableConfig(data);
    let adjustmentContext = this.getWriteCapacityDecrementAdjustmentContext(data, config);
    return this.isCapacityAdjustmentRequired(data, adjustmentContext);
  }

  calculateDecrementedWriteCapacityValue(data: TableProvisionedAndConsumedThroughput): number {
    invariant(data != null, 'Parameter \'data\' is not set');

    let config = this.getTableConfig(data);
    let adjustmentContext = this.getWriteCapacityDecrementAdjustmentContext(data, config);
    return Throughput.getAdjustedCapacityUnits(adjustmentContext);
  }

  getReadCapacityIncrementAdjustmentContext(data: TableProvisionedAndConsumedThroughput, config: ProvisionerConfig): AdjustmentContext {
    invariant(data != null, 'Argument \'data\' cannot be null');
    invariant(config != null, 'Argument \'config\' cannot be null');

    let context = {
      TableName: data.TableName,
      IndexName: data.IndexName,
      CapacityType: 'read',
      AdjustmentType: 'increment',
      ProvisionedValue: data.ProvisionedThroughput.ReadCapacityUnits,
      ConsumedValue: data.ConsumedThroughput.ReadCapacityUnits,
      ThrottledEvents: data.ThrottledEvents.ThrottledReadEvents,
      UtilisationPercent: (data.ConsumedThroughput.ReadCapacityUnits / data.ProvisionedThroughput.ReadCapacityUnits) * 100,
      CapacityConfig: config.ReadCapacity,
    };

    if (config.ReadCapacity.Increment != null) {
      // $FlowIgnore
      context.CapacityAdjustmentConfig = config.ReadCapacity.Increment;
    }

    return context;
  }

  getReadCapacityDecrementAdjustmentContext(data: TableProvisionedAndConsumedThroughput, config: ProvisionerConfig): AdjustmentContext {
    invariant(data != null, 'Argument \'data\' cannot be null');
    invariant(config != null, 'Argument \'config\' cannot be null');

    let context = {
      TableName: data.TableName,
      IndexName: data.IndexName,
      CapacityType: 'read',
      AdjustmentType: 'decrement',
      ProvisionedValue: data.ProvisionedThroughput.ReadCapacityUnits,
      ConsumedValue: data.ConsumedThroughput.ReadCapacityUnits,
      ThrottledEvents: data.ThrottledEvents.ThrottledReadEvents,
      UtilisationPercent: (data.ConsumedThroughput.ReadCapacityUnits / data.ProvisionedThroughput.ReadCapacityUnits) * 100,
      CapacityConfig: config.ReadCapacity,
    };

    if (config.ReadCapacity.Decrement != null) {
      // $FlowIgnore
      context.CapacityAdjustmentConfig = config.ReadCapacity.Decrement;
    }

    return context;
  }

  getWriteCapacityIncrementAdjustmentContext(data: TableProvisionedAndConsumedThroughput, config: ProvisionerConfig): AdjustmentContext {
    invariant(data != null, 'Argument \'data\' cannot be null');
    invariant(config != null, 'Argument \'config\' cannot be null');

    let context = {
      TableName: data.TableName,
      IndexName: data.IndexName,
      CapacityType: 'write',
      AdjustmentType: 'increment',
      ProvisionedValue: data.ProvisionedThroughput.WriteCapacityUnits,
      ConsumedValue: data.ConsumedThroughput.WriteCapacityUnits,
      ThrottledEvents: data.ThrottledEvents.ThrottledWriteEvents,
      UtilisationPercent: (data.ConsumedThroughput.WriteCapacityUnits / data.ProvisionedThroughput.WriteCapacityUnits) * 100,
      CapacityConfig: config.WriteCapacity,
    };

    if (config.WriteCapacity.Increment != null) {
      // $FlowIgnore
      context.CapacityAdjustmentConfig = config.WriteCapacity.Increment;
    }

    return context;
  }

  getWriteCapacityDecrementAdjustmentContext(data: TableProvisionedAndConsumedThroughput, config: ProvisionerConfig): AdjustmentContext {
    invariant(data != null, 'Argument \'data\' cannot be null');
    invariant(config != null, 'Argument \'config\' cannot be null');

    let context = {
      TableName: data.TableName,
      IndexName: data.IndexName,
      CapacityType: 'write',
      AdjustmentType: 'decrement',
      ProvisionedValue: data.ProvisionedThroughput.WriteCapacityUnits,
      ConsumedValue: data.ConsumedThroughput.WriteCapacityUnits,
      ThrottledEvents: data.ThrottledEvents.ThrottledWriteEvents,
      UtilisationPercent: (data.ConsumedThroughput.WriteCapacityUnits / data.ProvisionedThroughput.WriteCapacityUnits) * 100,
      CapacityConfig: config.WriteCapacity,
    };

    if (config.WriteCapacity.Decrement != null) {
      // $FlowIgnore
      context.CapacityAdjustmentConfig = config.WriteCapacity.Decrement;
    }

    return context;
  }

  isCapacityAdjustmentRequired(data: TableProvisionedAndConsumedThroughput, adjustmentContext: AdjustmentContext): boolean {

    // Determine if an adjustment is wanted
    let isProvAboveMax = adjustmentContext.CapacityConfig.Max == null ? false : adjustmentContext.ProvisionedValue > adjustmentContext.CapacityConfig.Max;
    let isProvBelowMax = adjustmentContext.CapacityConfig.Max == null ? true : adjustmentContext.ProvisionedValue < adjustmentContext.CapacityConfig.Max;
    let isProvBelowMin = adjustmentContext.CapacityConfig.Min == null ? adjustmentContext.ProvisionedValue < 1 : adjustmentContext.ProvisionedValue < adjustmentContext.CapacityConfig.Min;
    let isProvAboveMin = adjustmentContext.CapacityConfig.Min == null ? adjustmentContext.ProvisionedValue > 1 : adjustmentContext.ProvisionedValue > adjustmentContext.CapacityConfig.Min;
    let isUtilAboveThreshold = this.isAboveThreshold(adjustmentContext);
    let isUtilBelowThreshold = this.isBelowThreshold(adjustmentContext);
    let isThrottledEventsAboveThreshold = this.isThrottledEventsAboveThreshold(adjustmentContext);
    let isAdjustmentWanted = adjustmentContext.AdjustmentType === 'increment' ?
      (isProvBelowMin || isUtilAboveThreshold || isUtilBelowThreshold || isThrottledEventsAboveThreshold) && isProvBelowMax :
      (isProvAboveMax || isUtilAboveThreshold || isUtilBelowThreshold) && isProvAboveMin;

    // Determine if an adjustment is allowed under the rate limiting rules
    let isAfterLastDecreaseGracePeriod = adjustmentContext.CapacityAdjustmentConfig == null ||
      this.isAfterLastAdjustmentGracePeriod(data.ProvisionedThroughput.LastDecreaseDateTime,
        adjustmentContext.CapacityAdjustmentConfig.When.AfterLastDecrementMinutes);
    let isAfterLastIncreaseGracePeriod = adjustmentContext.CapacityAdjustmentConfig == null ||
      this.isAfterLastAdjustmentGracePeriod(data.ProvisionedThroughput.LastIncreaseDateTime,
        adjustmentContext.CapacityAdjustmentConfig.When.AfterLastIncrementMinutes);

    let isReadDecrementAllowed = adjustmentContext.AdjustmentType === 'decrement' ?
      RateLimitedDecrement.isDecrementAllowed(data, adjustmentContext, d => this.calculateDecrementedReadCapacityValue(d)) :
      true;

    let isAdjustmentAllowed = isAfterLastDecreaseGracePeriod && isAfterLastIncreaseGracePeriod && isReadDecrementAllowed;

    // Package up the configuration and the results so that we can produce
    // some effective logs
    let adjustmentData = {
      isAboveMax: isProvAboveMax,
      isBelowMin: isProvBelowMin,
      isAboveThreshold: isUtilAboveThreshold,
      isBelowThreshold: isUtilBelowThreshold,
      isAboveThrottledEventThreshold: isThrottledEventsAboveThreshold,
      isAfterLastDecreaseGracePeriod,
      isAfterLastIncreaseGracePeriod,
      isAdjustmentWanted,
      isAdjustmentAllowed
    };

    // Log and return result
    ProvisionerLogging.isAdjustmentRequiredLog(adjustmentContext, adjustmentData);
    return isAdjustmentWanted && isAdjustmentAllowed;
  }

  isThrottledEventsAboveThreshold(context: AdjustmentContext): boolean {
    invariant(context != null, 'Parameter \'context\' is not set');

    if (context.CapacityAdjustmentConfig == null ||
      context.CapacityAdjustmentConfig.When.ThrottledEventsPerMinuteIsAbove == null ||
      context.AdjustmentType === 'decrement') {
      return false;
    }

    return context.ThrottledEvents >
      context.CapacityAdjustmentConfig.When.ThrottledEventsPerMinuteIsAbove;
  }

  isAboveThreshold(context: AdjustmentContext): boolean {
    invariant(context != null, 'Parameter \'context\' is not set');

    if (context.CapacityAdjustmentConfig == null ||
      context.CapacityAdjustmentConfig.When.UtilisationIsAbovePercent == null) {
      return false;
    }

    let utilisationPercent = (context.ConsumedValue / context.ProvisionedValue) * 100;
    return utilisationPercent > context.CapacityAdjustmentConfig.When.UtilisationIsAbovePercent;
  }

  isBelowThreshold(context: AdjustmentContext): boolean {
    invariant(context != null, 'Parameter \'context\' is not set');

    if (context.CapacityAdjustmentConfig == null ||
      context.CapacityAdjustmentConfig.When.UtilisationIsBelowPercent == null) {
      return false;
    }

    let utilisationPercent = (context.ConsumedValue / context.ProvisionedValue) * 100;
    return utilisationPercent < context.CapacityAdjustmentConfig.When.UtilisationIsBelowPercent;
  }

  isAfterLastAdjustmentGracePeriod(lastAdjustmentDateTime: string, afterLastAdjustmentMinutes?: number): boolean {
    if (lastAdjustmentDateTime == null || afterLastAdjustmentMinutes == null) {
      return true;
    }

    let lastDecreaseDateTime = new Date(Date.parse(lastAdjustmentDateTime));
    let thresholdDateTime = new Date(Date.now());
    thresholdDateTime.setMinutes(thresholdDateTime.getMinutes() - (afterLastAdjustmentMinutes));
    return lastDecreaseDateTime < thresholdDateTime;
  }
}
