/* @flow */
import { invariant } from './Global';
import { Region } from './configuration/Region';
import CapacityCalculatorBase from './capacity/CapacityCalculatorBase';
import type { GetMetricStatisticsResponse } from 'aws-sdk';
import type { StatisticSettings } from './flow/FlowTypes';

export default class CapacityCalculator extends CapacityCalculatorBase {

  // Get the region
  getCloudWatchRegion() {
    return Region;
  }

  getStatisticSettings(): StatisticSettings {
    return {
      count: 5,
      spanMinutes: 1,
      type: 'Sum',
    };
  }

  getThrottledEventStatisticSettings(): StatisticSettings {
    return {
      count: 1,
      spanMinutes: 1,
      type: 'Sum',
    };
  }

  // Gets the projected capacity value based on the cloudwatch datapoints
  getProjectedValue(settings: StatisticSettings, data: GetMetricStatisticsResponse) {
    invariant(data != null, 'Parameter \'data\' is not set');

    if (data.Datapoints.length === 0) {
      return 0;
    }

    // Default algorithm for projecting a good value for the current ConsumedThroughput is:
    // 1. Query 5 average readings each spanning a minute
    // 2. Select the Max value from those 5 readings
    let spanSeconds = settings.spanMinutes * 60;
    let averages = data.Datapoints.map(dp => dp.Sum / spanSeconds);
    let projectedValue = Math.max(...averages);
    return projectedValue;
  }
}
