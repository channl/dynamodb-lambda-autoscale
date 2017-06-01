/* @flow */
/* eslint-disable max-len */
import invariant from 'invariant';
import RateLimitedDecrement from './utils/RateLimitedDecrement';
import ThroughputUtils from './utils/ThroughputUtils';
import ProvisionerLogging from './logging/ProvisionerLogging';
import type {
  TableDescription,
  UpdateTableRequest,
  GlobalSecondaryIndex,
  GlobalSecondaryIndexUpdate,
  Throughput,
} from 'aws-sdk';
import type {
  TableConsumedCapacityDescription,
  TableProvisionedAndConsumedThroughput,
  ProvisionerConfig,
  AdjustmentContext,
} from './flow/FlowTypes';

export default class ProvisionedThroughtputCalculator {
  async getTableUpdateAsync(
    tableDescription: TableDescription,
    tableConsumedCapacityDescription: TableConsumedCapacityDescription,
    config: ProvisionerConfig,
  ): Promise<?UpdateTableRequest> {
    invariant(tableDescription != null, 'Parameter tableDescription is not set');
    invariant(tableConsumedCapacityDescription != null, 'Parameter tableConsumedCapacityDescription is not set');

    let tableData = {
      TableName: tableDescription.TableName,
      ProvisionedThroughput: tableDescription.ProvisionedThroughput,
      ConsumedThroughput: tableConsumedCapacityDescription.ConsumedThroughput,
      ThrottledEvents: tableConsumedCapacityDescription.ThrottledEvents,
    };

    let provisionedThroughput = await this._getUpdatedProvisionedThroughputAsync(tableData, config);

    let gsis: GlobalSecondaryIndex[] = tableDescription.GlobalSecondaryIndexes || [];
    let globalSecondaryIndexUpdateTasks = await Promise.all(
      gsis.map(gsi =>
        this._getGlobalSecondaryIndexUpdateAsync(tableDescription, tableConsumedCapacityDescription, gsi, config),
      ),
    );
    let globalSecondaryIndexUpdates: GlobalSecondaryIndexUpdate[] = globalSecondaryIndexUpdateTasks.filter(
      i => i !== null,
    );

    // eslint-disable-next-line eqeqeq
    if (!provisionedThroughput && (globalSecondaryIndexUpdates == null || globalSecondaryIndexUpdates.length === 0)) {
      return null;
    }

    let result: UpdateTableRequest = {
      TableName: tableDescription.TableName,
    };

    if (provisionedThroughput) {
      result.ProvisionedThroughput = provisionedThroughput;
    }

    if (globalSecondaryIndexUpdates && globalSecondaryIndexUpdates.length > 0) {
      result.GlobalSecondaryIndexUpdates = globalSecondaryIndexUpdates;
    }

    return result;
  }

  async _getUpdatedProvisionedThroughputAsync(
    params: TableProvisionedAndConsumedThroughput,
    config: ProvisionerConfig,
  ): Promise<?Throughput> {
    invariant(params != null, 'Parameter params is not set');

    let newProvisionedThroughput = {
      ReadCapacityUnits: params.ProvisionedThroughput.ReadCapacityUnits,
      WriteCapacityUnits: params.ProvisionedThroughput.WriteCapacityUnits,
    };

    // Adjust read capacity
    if (this._isReadCapacityIncrementRequired(params, config)) {
      newProvisionedThroughput.ReadCapacityUnits = this._calculateIncrementedReadCapacityValue(params, config);
    } else if (this._isReadCapacityDecrementRequired(params, config)) {
      newProvisionedThroughput.ReadCapacityUnits = this._calculateDecrementedReadCapacityValue(params, config);
    }

    // Adjust write capacity
    if (this._isWriteCapacityIncrementRequired(params, config)) {
      newProvisionedThroughput.WriteCapacityUnits = this._calculateIncrementedWriteCapacityValue(params, config);
    } else if (this._isWriteCapacityDecrementRequired(params, config)) {
      newProvisionedThroughput.WriteCapacityUnits = this._calculateDecrementedWriteCapacityValue(params, config);
    }

    if (
      newProvisionedThroughput.ReadCapacityUnits === params.ProvisionedThroughput.ReadCapacityUnits &&
      newProvisionedThroughput.WriteCapacityUnits === params.ProvisionedThroughput.WriteCapacityUnits
    ) {
      return null;
    }

    return newProvisionedThroughput;
  }

  async _getGlobalSecondaryIndexUpdateAsync(
    tableDescription: TableDescription,
    tableConsumedCapacityDescription: TableConsumedCapacityDescription,
    gsi: GlobalSecondaryIndex,
    config: ProvisionerConfig,
  ): Promise<?GlobalSecondaryIndexUpdate> {
    invariant(tableDescription != null, 'Parameter tableDescription is not set');
    invariant(tableConsumedCapacityDescription != null, 'Parameter tableConsumedCapacityDescription is not set');
    invariant(gsi != null, 'Parameter gsi is not set');

    let gsicc = tableConsumedCapacityDescription.GlobalSecondaryIndexes.find(i => i.IndexName === gsi.IndexName);

    invariant(gsicc != null, 'Specified GSI could not be found');
    let provisionedThroughput = await this._getUpdatedProvisionedThroughputAsync(
      {
        TableName: tableDescription.TableName,
        IndexName: gsicc.IndexName,
        ProvisionedThroughput: gsi.ProvisionedThroughput,
        ConsumedThroughput: gsicc.ConsumedThroughput,
        ThrottledEvents: gsicc.ThrottledEvents,
      },
      config,
    );

    // eslint-disable-next-line eqeqeq
    if (provisionedThroughput == null) {
      return null;
    }

    return {
      Update: {
        IndexName: gsi.IndexName,
        ProvisionedThroughput: provisionedThroughput,
      },
    };
  }

  _isReadCapacityIncrementRequired(data: TableProvisionedAndConsumedThroughput, config: ProvisionerConfig): boolean {
    invariant(data != null, 'Parameter data is not set');
    invariant(config != null, 'Parameter config is not set');
    let adjustmentContext = this._getReadCapacityIncrementAdjustmentContext(data, config);
    return this._isCapacityAdjustmentRequired(data, adjustmentContext);
  }

  _calculateIncrementedReadCapacityValue(
    data: TableProvisionedAndConsumedThroughput,
    config: ProvisionerConfig,
  ): number {
    invariant(data != null, 'Parameter data is not set');
    invariant(config != null, 'Parameter config is not set');
    let adjustmentContext = this._getReadCapacityIncrementAdjustmentContext(data, config);
    return ThroughputUtils.getAdjustedCapacityUnits(adjustmentContext);
  }

  _isReadCapacityDecrementRequired(data: TableProvisionedAndConsumedThroughput, config: ProvisionerConfig): boolean {
    invariant(data != null, 'Parameter data is not set');
    invariant(config != null, 'Parameter config is not set');
    let adjustmentContext = this._getReadCapacityDecrementAdjustmentContext(data, config);
    return this._isCapacityAdjustmentRequired(data, adjustmentContext);
  }

  _calculateDecrementedReadCapacityValue(
    data: TableProvisionedAndConsumedThroughput,
    config: ProvisionerConfig,
  ): number {
    invariant(data != null, 'Parameter data is not set');
    invariant(config != null, 'Parameter config is not set');
    let adjustmentContext = this._getReadCapacityDecrementAdjustmentContext(data, config);
    return ThroughputUtils.getAdjustedCapacityUnits(adjustmentContext);
  }

  _isWriteCapacityIncrementRequired(data: TableProvisionedAndConsumedThroughput, config: ProvisionerConfig): boolean {
    invariant(data != null, 'Parameter data is not set');
    invariant(config != null, 'Parameter config is not set');
    let adjustmentContext = this._getWriteCapacityIncrementAdjustmentContext(data, config);
    return this._isCapacityAdjustmentRequired(data, adjustmentContext);
  }

  _calculateIncrementedWriteCapacityValue(
    data: TableProvisionedAndConsumedThroughput,
    config: ProvisionerConfig,
  ): number {
    invariant(data != null, 'Parameter data is not set');
    invariant(config != null, 'Parameter config is not set');
    let adjustmentContext = this._getWriteCapacityIncrementAdjustmentContext(data, config);
    return ThroughputUtils.getAdjustedCapacityUnits(adjustmentContext);
  }

  _isWriteCapacityDecrementRequired(data: TableProvisionedAndConsumedThroughput, config: ProvisionerConfig): boolean {
    invariant(data != null, 'Parameter data is not set');
    invariant(config != null, 'Parameter config is not set');
    let adjustmentContext = this._getWriteCapacityDecrementAdjustmentContext(data, config);
    return this._isCapacityAdjustmentRequired(data, adjustmentContext);
  }

  _calculateDecrementedWriteCapacityValue(
    data: TableProvisionedAndConsumedThroughput,
    config: ProvisionerConfig,
  ): number {
    invariant(data != null, 'Parameter data is not set');
    invariant(config != null, 'Parameter config is not set');
    let adjustmentContext = this._getWriteCapacityDecrementAdjustmentContext(data, config);
    return ThroughputUtils.getAdjustedCapacityUnits(adjustmentContext);
  }

  _getReadCapacityIncrementAdjustmentContext(
    data: TableProvisionedAndConsumedThroughput,
    config: ProvisionerConfig,
  ): AdjustmentContext {
    invariant(data != null, 'Argument data cannot be null');
    invariant(config != null, 'Argument config cannot be null');

    let context = {
      TableName: data.TableName,
      IndexName: data.IndexName,
      CapacityType: 'read',
      AdjustmentType: 'increment',
      ProvisionedValue: data.ProvisionedThroughput.ReadCapacityUnits,
      ConsumedValue: data.ConsumedThroughput.ReadCapacityUnits,
      ThrottledEvents: data.ThrottledEvents.ThrottledReadEvents,
      UtilisationPercent: data.ConsumedThroughput.ReadCapacityUnits /
        data.ProvisionedThroughput.ReadCapacityUnits *
        100,
      CapacityConfig: config.ReadCapacity,
    };

    if (config.ReadCapacity.Increment != null) {
      // $FlowIgnore
      context.CapacityAdjustmentConfig = config.ReadCapacity.Increment;
    }

    return context;
  }

  _getReadCapacityDecrementAdjustmentContext(
    data: TableProvisionedAndConsumedThroughput,
    config: ProvisionerConfig,
  ): AdjustmentContext {
    invariant(data != null, 'Argument data cannot be null');
    invariant(config != null, 'Argument config cannot be null');

    let context = {
      TableName: data.TableName,
      IndexName: data.IndexName,
      CapacityType: 'read',
      AdjustmentType: 'decrement',
      ProvisionedValue: data.ProvisionedThroughput.ReadCapacityUnits,
      ConsumedValue: data.ConsumedThroughput.ReadCapacityUnits,
      ThrottledEvents: data.ThrottledEvents.ThrottledReadEvents,
      UtilisationPercent: data.ConsumedThroughput.ReadCapacityUnits /
        data.ProvisionedThroughput.ReadCapacityUnits *
        100,
      CapacityConfig: config.ReadCapacity,
    };

    if (config.ReadCapacity.Decrement != null) {
      // $FlowIgnore
      context.CapacityAdjustmentConfig = config.ReadCapacity.Decrement;
    }

    return context;
  }

  _getWriteCapacityIncrementAdjustmentContext(
    data: TableProvisionedAndConsumedThroughput,
    config: ProvisionerConfig,
  ): AdjustmentContext {
    invariant(data != null, 'Argument data cannot be null');
    invariant(config != null, 'Argument config cannot be null');

    let context = {
      TableName: data.TableName,
      IndexName: data.IndexName,
      CapacityType: 'write',
      AdjustmentType: 'increment',
      ProvisionedValue: data.ProvisionedThroughput.WriteCapacityUnits,
      ConsumedValue: data.ConsumedThroughput.WriteCapacityUnits,
      ThrottledEvents: data.ThrottledEvents.ThrottledWriteEvents,
      UtilisationPercent: data.ConsumedThroughput.WriteCapacityUnits /
        data.ProvisionedThroughput.WriteCapacityUnits *
        100,
      CapacityConfig: config.WriteCapacity,
    };

    if (config.WriteCapacity.Increment != null) {
      // $FlowIgnore
      context.CapacityAdjustmentConfig = config.WriteCapacity.Increment;
    }

    return context;
  }

  _getWriteCapacityDecrementAdjustmentContext(
    data: TableProvisionedAndConsumedThroughput,
    config: ProvisionerConfig,
  ): AdjustmentContext {
    invariant(data != null, 'Argument data cannot be null');
    invariant(config != null, 'Argument config cannot be null');

    let context = {
      TableName: data.TableName,
      IndexName: data.IndexName,
      CapacityType: 'write',
      AdjustmentType: 'decrement',
      ProvisionedValue: data.ProvisionedThroughput.WriteCapacityUnits,
      ConsumedValue: data.ConsumedThroughput.WriteCapacityUnits,
      ThrottledEvents: data.ThrottledEvents.ThrottledWriteEvents,
      UtilisationPercent: data.ConsumedThroughput.WriteCapacityUnits /
        data.ProvisionedThroughput.WriteCapacityUnits *
        100,
      CapacityConfig: config.WriteCapacity,
    };

    if (config.WriteCapacity.Decrement != null) {
      // $FlowIgnore
      context.CapacityAdjustmentConfig = config.WriteCapacity.Decrement;
    }

    return context;
  }

  _isCapacityAdjustmentRequired(
    data: TableProvisionedAndConsumedThroughput,
    adjustmentContext: AdjustmentContext,
  ): boolean {
    // Determine if an adjustment is wanted
    let isProvAboveMax = adjustmentContext.CapacityConfig.Max == null
      ? false
      : adjustmentContext.ProvisionedValue > adjustmentContext.CapacityConfig.Max;
    let isProvBelowMax = adjustmentContext.CapacityConfig.Max == null
      ? true
      : adjustmentContext.ProvisionedValue < adjustmentContext.CapacityConfig.Max;
    let isProvBelowMin = adjustmentContext.CapacityConfig.Min == null
      ? adjustmentContext.ProvisionedValue < 1
      : adjustmentContext.ProvisionedValue < adjustmentContext.CapacityConfig.Min;
    let isProvAboveMin = adjustmentContext.CapacityConfig.Min == null
      ? adjustmentContext.ProvisionedValue > 1
      : adjustmentContext.ProvisionedValue > adjustmentContext.CapacityConfig.Min;
    let isUtilAboveThreshold = this._isAboveThreshold(adjustmentContext);
    let isUtilBelowThreshold = this._isBelowThreshold(adjustmentContext);
    let isThrottledEventsAboveThreshold = this._isThrottledEventsAboveThreshold(adjustmentContext);
    let isAdjustmentWanted = adjustmentContext.AdjustmentType === 'increment'
      ? (isProvBelowMin || isUtilAboveThreshold || isUtilBelowThreshold || isThrottledEventsAboveThreshold) &&
          isProvBelowMax
      : (isProvAboveMax || isUtilAboveThreshold || isUtilBelowThreshold) && isProvAboveMin;

    // Determine if an adjustment is allowed under the rate limiting rules
    let isAfterLastDecreaseGracePeriod =
      adjustmentContext.CapacityAdjustmentConfig == null ||
      this._isAfterLastAdjustmentGracePeriod(
        data.ProvisionedThroughput.LastDecreaseDateTime,
        adjustmentContext.CapacityAdjustmentConfig.When.AfterLastDecrementMinutes,
      );
    let isAfterLastIncreaseGracePeriod =
      adjustmentContext.CapacityAdjustmentConfig == null ||
      this._isAfterLastAdjustmentGracePeriod(
        data.ProvisionedThroughput.LastIncreaseDateTime,
        adjustmentContext.CapacityAdjustmentConfig.When.AfterLastIncrementMinutes,
      );

    let isDecrementAllowed = adjustmentContext.AdjustmentType === 'decrement'
      ? RateLimitedDecrement.isDecrementAllowed(data, adjustmentContext, ac =>
          ThroughputUtils.getAdjustedCapacityUnits(ac),
        )
      : true;

    let isAdjustmentAllowed = isAfterLastDecreaseGracePeriod && isAfterLastIncreaseGracePeriod && isDecrementAllowed;

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
      isAdjustmentAllowed,
    };

    // Log and return result
    ProvisionerLogging.isAdjustmentRequiredLog(adjustmentContext, adjustmentData);
    return isAdjustmentWanted && isAdjustmentAllowed;
  }

  _isThrottledEventsAboveThreshold(context: AdjustmentContext): boolean {
    invariant(context != null, 'Parameter context is not set');

    if (
      context.CapacityAdjustmentConfig == null ||
      context.CapacityAdjustmentConfig.When.ThrottledEventsPerMinuteIsAbove == null ||
      context.AdjustmentType === 'decrement'
    ) {
      return false;
    }

    return context.ThrottledEvents > context.CapacityAdjustmentConfig.When.ThrottledEventsPerMinuteIsAbove;
  }

  _isAboveThreshold(context: AdjustmentContext): boolean {
    invariant(context != null, 'Parameter context is not set');

    if (
      context.CapacityAdjustmentConfig == null ||
      context.CapacityAdjustmentConfig.When.UtilisationIsAbovePercent == null
    ) {
      return false;
    }

    let utilisationPercent = context.ConsumedValue / context.ProvisionedValue * 100;
    return utilisationPercent > context.CapacityAdjustmentConfig.When.UtilisationIsAbovePercent;
  }

  _isBelowThreshold(context: AdjustmentContext): boolean {
    invariant(context != null, 'Parameter context is not set');

    if (
      context.CapacityAdjustmentConfig == null ||
      context.CapacityAdjustmentConfig.When.UtilisationIsBelowPercent == null
    ) {
      return false;
    }

    let utilisationPercent = context.ConsumedValue / context.ProvisionedValue * 100;
    return utilisationPercent < context.CapacityAdjustmentConfig.When.UtilisationIsBelowPercent;
  }

  _isAfterLastAdjustmentGracePeriod(lastAdjustmentDateTime: string, afterLastAdjustmentMinutes?: number): boolean {
    if (lastAdjustmentDateTime == null || afterLastAdjustmentMinutes == null) {
      return true;
    }

    let lastDecreaseDateTime = new Date(Date.parse(lastAdjustmentDateTime));
    let thresholdDateTime = new Date(Date.now());
    thresholdDateTime.setMinutes(thresholdDateTime.getMinutes() - afterLastAdjustmentMinutes);
    return lastDecreaseDateTime < thresholdDateTime;
  }
}
