import { LENGTH, COLOR, CSS, oneOf } from './common.js';

export default {
  group: 'shape',
  fields: {
    radius: LENGTH,
    border: {
      type: 'object',
      fields: {
        width: LENGTH,
        style: oneOf('none', 'solid', 'dashed', 'dotted', 'double'),
        color: COLOR
      }
    },
    mask: CSS,
    clip: CSS,
    shape: oneOf('rectangle', 'rounded', 'pill', 'circle', 'custom')
  }
};
