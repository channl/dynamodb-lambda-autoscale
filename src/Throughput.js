export default class Throughput {
  static getReadCapacityUtilisationPercent(data) {
    return (
      data.ConsumedThroughput.ReadCapacityUnits /
        data.ProvisionedThroughput.ReadCapacityUnits) * 100;
  }

  static getPercentAdjustedReadCapacityUnits(
    data, adjustmentPercent, adjustmentUnits, max, min) {
    let units = Math.round(
      data.ProvisionedThroughput.ReadCapacityUnits * (adjustmentPercent / 100));
    units = Math.max(units, adjustmentUnits);
    let newValue = data.ProvisionedThroughput.ReadCapacityUnits + units;
    return Math.max(Math.min(newValue, max), min);
  }

  static getWriteCapacityUtilisationPercent(data) {
    return (
      data.ConsumedThroughput.WriteCapacityUnits /
      data.ProvisionedThroughput.WriteCapacityUnits) * 100;
  }

  static getPercentAdjustedWriteCapacityUnits(
    data, adjustmentPercent, adjustmentUnits, max, min) {
    let units = Math.round(
      data.ProvisionedThroughput.WriteCapacityUnits *
      (adjustmentPercent / 100));

    units = Math.max(units, adjustmentUnits);
    let newValue = data.ProvisionedThroughput.WriteCapacityUnits + units;
    return Math.max(Math.min(newValue, max), min);
  }
}
