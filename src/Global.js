import measured from 'measured';
import _warning from 'warning';
import _invariant from 'invariant';

export const json = { padding: 0 };

export const stats = measured.createCollection();

export const log = (...params) => {
  // eslint-disable-next-line no-console
  console.log(...params);
};

export const warning = (predicateOrValue, value) => {
  if (typeof value === 'undefined') {
    _warning(false, predicateOrValue);
  } else {
    _warning(predicateOrValue, value);
  }
};

export const invariant = (predicateOrValue, value) => {
  if (typeof value === 'undefined') {
    _invariant(false, predicateOrValue);
  } else {
    _invariant(predicateOrValue, value);
  }
};
