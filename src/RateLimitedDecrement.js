export default class RateLimitedDecrement {

  static isReadDecrementAllowed(
    data, calcNewValueFunc, minAdjustment,
    minGracePeriodAfterLastIncrementMinutes,
    minGracePeriodAfterLastDecrementMinutes) {
    if (this.getNextAllowedDecrementDate(
      data, minGracePeriodAfterLastIncrementMinutes,
      minGracePeriodAfterLastDecrementMinutes) > this.getNowDate()) {
      // Disallow if we havent crossed one of four time barriers
      return false;
    }

    let adjustment = data.ProvisionedThroughput.ReadCapacityUnits -
      calcNewValueFunc(data);

    if (adjustment < minAdjustment &&
      this.getNowDate().valueOf() <
      this.getLastAllowedDecrementDate().valueOf()) {
      // Disallow if the adjustment is very small.
      // However, if we have crossed the last time
      // barrier of the day then we might as well allow it.
      return false;
    }

    return true;
  }

  static isWriteDecrementAllowed(
    data, calcNewValueFunc, minAdjustment,
    minGracePeriodAfterLastIncrementMinutes,
    minGracePeriodAfterLastDecrementMinutes) {

    if (this.getNextAllowedDecrementDate(
      data, minGracePeriodAfterLastIncrementMinutes,
      minGracePeriodAfterLastDecrementMinutes) > this.getNowDate()) {
      // Disallow if we havent crossed one of four time barriers
      return false;
    }

    let adjustment = data.ProvisionedThroughput.WriteCapacityUnits -
      calcNewValueFunc(data);

    if (adjustment < minAdjustment && this.getNowDate().valueOf() <
      this.getLastAllowedDecrementDate().valueOf()) {
      // Disallow if the adjustment is very small.
      // However, if we have crossed the last time
      // barrier of the day then we might as well allow it.
      return false;
    }

    return true;
  }

  static getNextAllowedDecrementDate(
    data,
    minGracePeriodAfterLastIncrementMinutes,
    minGracePeriodAfterLastDecrementMinutes) {

    let lastDecrease = this.parseDate(
      data.ProvisionedThroughput.LastDecreaseDateTime);

    if (data.ProvisionedThroughput.NumberOfDecreasesToday >= 4) {
      // Had all the decreases we are allowed
      return this.getTomorrowDate();
    }

    // Get the last decrease or start of day
    let lastDecrementDate = this.getLastDecrementDate(lastDecrease);

    // Get the next allowed decrement
    let lastAllowedDecrementDate = this.getLastAllowedDecrementDate();
    let periodMs = lastAllowedDecrementDate.valueOf() -
      lastDecrementDate.valueOf();

    let periodMs2 = periodMs /
      (5 - data.ProvisionedThroughput.NumberOfDecreasesToday);

    let nextDecrementDate = this.getLastDecrementDate(lastDecrease);
    nextDecrementDate.setMilliseconds(
      nextDecrementDate.getMilliseconds() + periodMs2);

    // Handle grace periods
    let withIncrementGracePeriod = this.parseDate(
      data.ProvisionedThroughput.LastIncreaseDateTime);

    withIncrementGracePeriod.setMinutes(withIncrementGracePeriod.getMinutes() +
      minGracePeriodAfterLastIncrementMinutes);

    let withDecrementGracePeriod = this.parseDate(
      data.ProvisionedThroughput.LastDecreaseDateTime);

    withDecrementGracePeriod.setMinutes(withDecrementGracePeriod.getMinutes() +
      minGracePeriodAfterLastDecrementMinutes);

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
    if (typeof value === 'undefined' || value === null) {
      return new Date(-8640000000000000);
    }

    return new Date(Date.parse(value));
  }
}
