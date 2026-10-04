import { LENGTH, num, oneOf } from './common.js';

export default {
  group: 'positioning',
  fields: {
    align: oneOf('start', 'center', 'end', 'stretch'),
    position: oneOf('static', 'relative', 'absolute', 'fixed', 'sticky'),
    offsetX: LENGTH,
    offsetY: LENGTH,
    zIndex: num(-1000, 1000, { int: true }),
    stickyTop: LENGTH,
    floating: { type: 'boolean' }
  }
};
