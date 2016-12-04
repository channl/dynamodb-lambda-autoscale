/* @flow */
import { json, warning, invariant } from '../Global';
import type {
  Throughput,
} from 'aws-sdk';

export default class CostEstimation {

  static getMonthlyEstimatedTableCost(provisionedThroughput: Throughput) {
    try {
      invariant(provisionedThroughput != null, 'Parameter \'provisionedThroughput\' is not set');

      const averageHoursPerMonth = 720;
      const readCostPerHour = 0.0065;
      const readCostUnits = 50;
      const writeCostPerHour = 0.0065;
      const writeCostUnits = 10;

      let readCost = provisionedThroughput.ReadCapacityUnits /
        readCostUnits * readCostPerHour * averageHoursPerMonth;

      let writeCost = provisionedThroughput.WriteCapacityUnits /
        writeCostUnits * writeCostPerHour * averageHoursPerMonth;

      return readCost + writeCost;
    } catch (ex) {
      warning(JSON.stringify({
        class: 'CostEstimation',
        function: 'getMonthlyEstimatedTableCost',
        provisionedThroughput
      }, null, json.padding));
      throw ex;
    }
  }
}
