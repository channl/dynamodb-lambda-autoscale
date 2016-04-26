class RateLimitedDecrement {

  // TODO dont allow decrement if its going to be really small change

  static isDecrementAllowed(data) {
    return this.getNextAllowedDecrementDate(data) <= this.getNowDate();
  }

  static getNextAllowedDecrementDate(data) {
    let lastDecrease = this.parseDate(data.ProvisionedThroughput.LastDecreaseDateTime);

    if (data.ProvisionedThroughput.NumberOfDecreasesToday >= 4) {
      // Had all the decreases we are allowed
      return this.getTomorrowDate();
    }

    // Get the last decrease or start of day
    let lastDecrementDate = this.getLastDecrementDate(lastDecrease);

    // Get the next allowed decrement
    let lastAllowedDecrementDate = this.getLastAllowedDecrementDate();
    let periodMs = lastAllowedDecrementDate.valueOf() - lastDecrementDate.valueOf();
    let periodMs2 = periodMs / (5 - data.ProvisionedThroughput.NumberOfDecreasesToday);
    let nextDecrementDate = this.getLastDecrementDate(lastDecrease);
    nextDecrementDate.setMilliseconds(nextDecrementDate.getMilliseconds() + periodMs2);
    return nextDecrementDate;
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

  static getLastDecrementDate(lastDecrease){
    let today = this.getTodayDate();
    return lastDecrease < today ? today : new Date(lastDecrease.valueOf());
  }

  static parseDate(value) {
    if (typeof value === 'undefined' || value == null) {
       return new Date(-8640000000000000);
    }

    return Date.parse(value);
  }
}

export default RateLimitedDecrement;
