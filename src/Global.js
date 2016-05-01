import winston from 'winston';
import measured from 'measured';

export default {
  stats: measured.createCollection(),
  logger: new winston.Logger({
    level: 'info',
    transports: [
      new (winston.transports.Console)({
        level: 'info',
        colorize: true,
        timestamp: true
      })
    ]
  })
};

winston.addColors({
  debug: 'white',
  info: 'green',
  warn: 'yellow',
  error: 'red',
});
