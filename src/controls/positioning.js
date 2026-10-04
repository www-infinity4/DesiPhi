import { LENGTH, num, oneOf } from './common.js';

export default {
  group: 'positioning',
  fields: {
    align: oneOf('start', 'center', 'end', 'stretch'),
    position: oneOf('static', 'relative', 'absolute', 'sticky'),
    offsetX: LENGTH,
    offsetY: LENGTH,
    zIndex: num(-10, 1000, { int: true })
  }
};
