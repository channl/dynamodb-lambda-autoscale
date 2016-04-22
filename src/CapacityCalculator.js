import Global from './global';
const {
  stats,
  logger
} = Global;

class CapacityCalculator {

  getNewCapacity(capa, used, upperThsd, lowerThsd, increseAmt, decreseAmt, min, max, decreasesToday, lastIncrease, lastDecrease) {
    let rate = (used / capa) * 100;
    if (rate > upperThsd) {
      let newCapa = Math.min(Math.round(capa + (capa * (increseAmt / 100))), max);
      if (newCapa !== capa) {
        logger.debug(JSON.stringify({capa, newCapa, used, upperThsd, lowerThsd, increseAmt, decreseAmt, min, max, decreasesToday, lastIncrease: lastIncrease.toString(), lastDecrease: lastDecrease.toString()}));
        return newCapa;
      }
    }

    if (rate < lowerThsd) {
      let newCapa = Math.max(Math.round(capa - (capa * (decreseAmt / 100))), min);
      let nextAllowedDecrementDate = this.getNextAllowedDecrementDate(lastDecrease, decreasesToday);
      let isDecrementAllowed = nextAllowedDecrementDate > Date.now();
      // logger.debug('Next decrement allowed at ' + nextAllowedDecrementDate.toString());

      if (newCapa !== capa && !isDecrementAllowed) {
        logger.warn('Decrement not allowed.  Next possible decrement is at ' + nextAllowedDecrementDate.toString());
        return capa;
      }

      if (newCapa !== capa) {
        logger.debug(JSON.stringify({capa, newCapa, used, upperThsd, lowerThsd, increseAmt, decreseAmt, min, max, decreasesToday, lastIncrease: lastIncrease.toString(), lastDecrease: lastDecrease.toString()}));
        return newCapa;
      }
    }

    return capa;
  }

  getNowDate() {
    return new Date(Date.now());
  }

  getTodayDate() {
    let value = this.getNowDate();
    value.setHours(0, 0, 0, 0);
    return value;
  }

  getTomorrowDate() {
    let value = this.getTodayDate();
    value.setDate(value.getDate() + 1);
    return value;
  }

  getLastAllowedDecrementDate() {
    let value = this.getTodayDate();
    value.setHours(23, 30, 0, 0);
    return value;
  }

  getLastDecrementDate(lastDecrease){
    let today = this.getTodayDate();
    return lastDecrease < today ? today : new Date(lastDecrease.valueOf());
  }

  getNextAllowedDecrementDate(lastDecrease, decreasesToday) {
    if (decreasesToday >= 4) {
      // Had all the decreases we are allowed
      return this.getTomorrowDate();
    }

    // Get the last decrease or start of day
    let lastDecrementDate = this.getLastDecrementDate(lastDecrease);

    // Get the next allowed decrement
    let lastAllowedDecrementDate = this.getLastAllowedDecrementDate();
    let periodMs = lastAllowedDecrementDate.valueOf() - lastDecrementDate.valueOf();
    let periodMs2 = periodMs / (5 - decreasesToday);
    let nextDecrementDate = this.getLastDecrementDate(lastDecrease);
    nextDecrementDate.setMilliseconds(nextDecrementDate.getMilliseconds() + periodMs2);

    // logger.debug(JSON.stringify({lastAllowedDecrementDate, lastDecrementDate, decreasesToday, periodMs, periodMs2, nextDecrementDate}, null, 2));
    return nextDecrementDate;
  }
}

export default CapacityCalculator;
