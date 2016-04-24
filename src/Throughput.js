class Throughput {
  static getReadCapacityUtilisationPercent(data) {
    return (data.ConsumedThroughput.ReadCapacityUnits / data.ProvisionedThroughput.ReadCapacityUnits) * 100;
  }

  static getPercentAdjustedReadCapacityUnits(data, max, min) {
    let adjustmentUnits = Math.round(data.ProvisionedThroughput.ReadCapacityUnits * (adjustmentPercent / 100));
    let newValue = data.ProvisionedThroughput.ReadCapacityUnits + adjustmentUnits;
    return Math.max(Math.min(newValue, max), min);
  }

  static getWriteCapacityUtilisationPercent(data) {
    return (data.ConsumedThroughput.WriteCapacityUnits / data.ProvisionedThroughput.WriteCapacityUnits) * 100;
  }

  static getPercentAdjustedWriteCapacityUnits(data, max, min) {
    let adjustmentUnits = Math.round(data.ProvisionedThroughput.WriteCapacityUnits * (adjustmentPercent / 100));
    let newValue = data.ProvisionedThroughput.WriteCapacityUnits + adjustmentUnits;
    return Math.max(Math.min(newValue, max), min);
  }
}

export default Throughput;
