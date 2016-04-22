import Stats from './Stats';
import winston from 'winston';
import measured from 'measured';

const glob = {
  stats : measured.createCollection(),
  logger : new winston.Logger({
    levels: {
      trace: 0,
      debug: 1,
      info: 2,
      warn: 3,
      crit: 4,
      fatal: 5
    },
    transports: [
      new winston.transports.Console({
        level: 'debug',
        colorize: true,
        timestamp: true
      })
    ]
  })
};

winston.addColors({
  trace: 'white',
  debug: 'green',
  info: 'green',
  warn: 'yellow',
  crit: 'red',
  fatal: 'red'
});

export default glob;
