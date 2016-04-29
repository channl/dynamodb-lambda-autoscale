import Stats from './Stats';
import winston from 'winston';
import measured from 'measured';

const glob = {
  stats : measured.createCollection(),
  logger : new winston.Logger({
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

export default glob;
