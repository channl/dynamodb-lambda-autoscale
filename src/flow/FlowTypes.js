/* @flow */
import type { ProvisionedThroughput, Throughput } from 'aws-sdk';

export type ThrottledEventsDescription = {
  ThrottledReadEvents: number,
  ThrottledWriteEvents: number
}

export type TableProvisionedAndConsumedThroughput = {
  TableName: string,
  IndexName?: string,
  ProvisionedThroughput: ProvisionedThroughput,
  ConsumedThroughput: Throughput,
  ThrottledEvents: ThrottledEventsDescription
};

export type GlobalSecondaryIndexConsumedThroughput = {
  IndexName: string,
  ConsumedThroughput: Throughput,
  ThrottledEvents: ThrottledEventsDescription,
};

export type TableConsumedCapacityDescription = {
  TableName: string,
  ConsumedThroughput: Throughput,
  GlobalSecondaryIndexes: GlobalSecondaryIndexConsumedThroughput[],
  ThrottledEvents: ThrottledEventsDescription,
};

export type ConsumedCapacityDesc = {
  tableName: string,
  globalSecondaryIndexName: ?string,
  value: number,
};

export type ProvisionerConfig = {
  ReadCapacity: CapacityConfig,
  WriteCapacity: CapacityConfig,
};

export type CapacityConfig = {
  Min?: number,
  Max?: number,
  Increment?: CapacityAdjustmentConfig,
  Decrement?: CapacityAdjustmentConfig,
};

export type CapacityAdjustmentConfig = {
  When: WhenConfig,
  By?: ByToConfig,
  To?: ByToConfig,
};

export type WhenConfig = {
  UtilisationIsAbovePercent?: number,
  UtilisationIsBelowPercent?: number,
  ThrottledEventsPerMinuteIsAbove?: number,
  AfterLastIncrementMinutes?: number,
  AfterLastDecrementMinutes?: number,
  UnitAdjustmentGreaterThan?: number,
};

export type ByToConfig = {
  ConsumedPercent?: number,
  ProvisionedPercent?: number,
  Units?: number,
  ThrottledEventsWithMultiplier?: number,
};

export type StatisticSettings = {
  count: number,
  spanMinutes: number,
  type: 'Average' | 'Sum',
};

export type AdjustmentContext = {
  TableName: string,
  IndexName?: string,
  CapacityType: 'read' | 'write',
  AdjustmentType: 'increment' | 'decrement',
  ProvisionedValue: number,
  ConsumedValue: number,
  ThrottledEvents: number,
  UtilisationPercent: number,
  CapacityConfig: CapacityConfig,
  CapacityAdjustmentConfig?: CapacityAdjustmentConfig,
};

export type AdjustmentData = {
  isAboveMax: boolean,
  isBelowMin: boolean,
  isAboveThreshold: boolean,
  isBelowThreshold: boolean,
  isAboveThrottledEventThreshold: boolean,
  isAfterLastDecreaseGracePeriod: boolean,
  isAfterLastIncreaseGracePeriod: boolean,
  isAdjustmentWanted: boolean,
  isAdjustmentAllowed: boolean
};
