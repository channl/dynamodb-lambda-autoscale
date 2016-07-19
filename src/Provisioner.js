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
    if (config.ReadCapacity.Increment == null) {
      return false;
    }

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
    if (config.ReadCapacity.Decrement == null) {
      return false;
    }

    let adjustmentContext = this.getReadCapacityDecrementAdjustmentContext(data, config);
    return this.isCapacityAdjustmentRequired(data, adjustmentContext, d => this.calculateDecrementedReadCapacityValue(d));
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
    if (config.WriteCapacity.Increment == null) {
      return false;
    }

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
    if (config.WriteCapacity.Decrement == null) {
      return false;
    }

    let adjustmentContext = this.getWriteCapacityDecrementAdjustmentContext(data, config);
    return this.isCapacityAdjustmentRequired(data, adjustmentContext, this.calculateDecrementedWriteCapacityValue);
  }

  calculateDecrementedWriteCapacityValue(data: TableProvisionedAndConsumedThroughput): number {
    invariant(data != null, 'Parameter \'data\' is not set');

    let config = this.getTableConfig(data);
    let adjustmentContext = this.getWriteCapacityDecrementAdjustmentContext(data, config);
    return Throughput.getAdjustedCapacityUnits(adjustmentContext);
  }

  getReadCapacityIncrementAdjustmentContext(data: TableProvisionedAndConsumedThroughput, config: ProvisionerConfig): AdjustmentContext {
    invariant(config.ReadCapacity.Increment != null, 'Increment cannot be null');

    return {
      TableName: data.TableName,
      IndexName: data.IndexName,
      CapacityType: 'read',
      AdjustmentType: 'increment',
      ProvisionedValue: data.ProvisionedThroughput.ReadCapacityUnits,
      ConsumedValue: data.ConsumedThroughput.ReadCapacityUnits,
      UtilisationPercent: (data.ConsumedThroughput.ReadCapacityUnits / data.ProvisionedThroughput.ReadCapacityUnits) * 100,
      CapacityConfig: config.ReadCapacity,
      CapacityAdjustmentConfig: config.ReadCapacity.Increment,
    };
  }

  getReadCapacityDecrementAdjustmentContext(data: TableProvisionedAndConsumedThroughput, config: ProvisionerConfig): AdjustmentContext {
    invariant(config.ReadCapacity.Decrement != null, 'Decrement cannot be null');

    return {
      TableName: data.TableName,
      IndexName: data.IndexName,
      CapacityType: 'read',
      AdjustmentType: 'decrement',
      ProvisionedValue: data.ProvisionedThroughput.ReadCapacityUnits,
      ConsumedValue: data.ConsumedThroughput.ReadCapacityUnits,
      UtilisationPercent: (data.ConsumedThroughput.ReadCapacityUnits / data.ProvisionedThroughput.ReadCapacityUnits) * 100,
      CapacityConfig: config.ReadCapacity,
      CapacityAdjustmentConfig: config.ReadCapacity.Decrement,
    };
  }

  getWriteCapacityIncrementAdjustmentContext(data: TableProvisionedAndConsumedThroughput, config: ProvisionerConfig): AdjustmentContext {
    invariant(config.WriteCapacity.Increment != null, 'Increment cannot be null');

    return {
      TableName: data.TableName,
      IndexName: data.IndexName,
      CapacityType: 'write',
      AdjustmentType: 'increment',
      ProvisionedValue: data.ProvisionedThroughput.WriteCapacityUnits,
      ConsumedValue: data.ConsumedThroughput.WriteCapacityUnits,
      UtilisationPercent: (data.ConsumedThroughput.WriteCapacityUnits / data.ProvisionedThroughput.WriteCapacityUnits) * 100,
      CapacityConfig: config.WriteCapacity,
      CapacityAdjustmentConfig: config.WriteCapacity.Increment,
    };
  }

  getWriteCapacityDecrementAdjustmentContext(data: TableProvisionedAndConsumedThroughput, config: ProvisionerConfig): AdjustmentContext {
    invariant(config.WriteCapacity.Decrement != null, 'Decrement cannot be null');

    return {
      TableName: data.TableName,
      IndexName: data.IndexName,
      CapacityType: 'write',
      AdjustmentType: 'decrement',
      ProvisionedValue: data.ProvisionedThroughput.WriteCapacityUnits,
      ConsumedValue: data.ConsumedThroughput.WriteCapacityUnits,
      UtilisationPercent: (data.ConsumedThroughput.WriteCapacityUnits / data.ProvisionedThroughput.WriteCapacityUnits) * 100,
      CapacityConfig: config.WriteCapacity,
      CapacityAdjustmentConfig: config.WriteCapacity.Decrement,
    };
  }

  isCapacityAdjustmentRequired(data: TableProvisionedAndConsumedThroughput, adjustmentContext: AdjustmentContext): boolean {

    // Determine if an adjustment is wanted
    let isAboveMax = this.isAboveMax(adjustmentContext);
    let isBelowMin = this.isBelowMin(adjustmentContext);
    let isAboveThreshold = this.isAboveThreshold(adjustmentContext);
    let isBelowThreshold = this.isBelowThreshold(adjustmentContext);
    let isAdjustmentWanted = (isAboveMax || isBelowMin || isAboveThreshold || isBelowThreshold);

    // Determine if an adjustment is allowed under the rate limiting rules
    let isAfterLastDecreaseGracePeriod = this.isAfterLastAdjustmentGracePeriod(
      data.ProvisionedThroughput.LastDecreaseDateTime,
      adjustmentContext.CapacityAdjustmentConfig.When.AfterLastDecrementMinutes);
    let isAfterLastIncreaseGracePeriod = this.isAfterLastAdjustmentGracePeriod(
      data.ProvisionedThroughput.LastIncreaseDateTime,
      adjustmentContext.CapacityAdjustmentConfig.When.AfterLastIncrementMinutes);

    let isReadDecrementAllowed = adjustmentContext.AdjustmentType === 'decrement' ?
      RateLimitedDecrement.isDecrementAllowed(data, adjustmentContext, d => this.calculateDecrementedReadCapacityValue(d)) :
      true;

    let isAdjustmentAllowed = isAfterLastDecreaseGracePeriod && isAfterLastIncreaseGracePeriod && isReadDecrementAllowed;

    // Package up the configuration and the results so that we can produce
    // some effective logs
    let adjustmentData = {
      isAboveMax,
      isBelowMin,
      isAboveThreshold,
      isBelowThreshold,
      isAfterLastDecreaseGracePeriod,
      isAfterLastIncreaseGracePeriod,
      isAdjustmentWanted,
      isAdjustmentAllowed
    };

    // Log and return result
    ProvisionerLogging.isAdjustmentRequiredLog(adjustmentContext, adjustmentData);
    return isAdjustmentWanted && isAdjustmentAllowed;
  }

  isAboveThreshold(context: AdjustmentContext): boolean {
    invariant(context != null, 'Parameter \'context\' is not set');

    if (context.CapacityAdjustmentConfig.When.UtilisationIsAbovePercent == null) {
      return false;
    }

    if (context.CapacityConfig.Max != null &&
      context.ProvisionedValue >= context.CapacityConfig.Max) {
      // Already at maximum allowed ProvisionedValue
      return false;
    }

    let utilisationPercent = (context.ConsumedValue / context.ProvisionedValue) * 100;
    return utilisationPercent > context.CapacityAdjustmentConfig.When.UtilisationIsAbovePercent;
  }

  isBelowThreshold(context: AdjustmentContext): boolean {
    invariant(context != null, 'Parameter \'context\' is not set');

    if (context.CapacityAdjustmentConfig.When.UtilisationIsBelowPercent == null) {
      return false;
    }

    let min = context.CapacityConfig.Min != null ? context.CapacityConfig.Min : 1;
    if (context.ProvisionedValue <= min) {
      // Already at minimum allowed ProvisionedValue
      return false;
    }

    let utilisationPercent = (context.ConsumedValue / context.ProvisionedValue) * 100;
    return utilisationPercent < context.CapacityAdjustmentConfig.When.UtilisationIsBelowPercent;
  }

  isAboveMax(context: AdjustmentContext): boolean {
    invariant(context != null, 'Parameter \'context\' is not set');

    if (context.CapacityConfig.Max == null) {
      return false;
    }

    return context.ProvisionedValue > context.CapacityConfig.Max;
  }

  isBelowMin(context: AdjustmentContext): boolean {
    invariant(context != null, 'Parameter \'context\' is not set');

    if (context.CapacityConfig.Min == null) {
      return false;
    }

    return context.ProvisionedValue < context.CapacityConfig.Min;
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
