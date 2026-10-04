import { LENGTH, CSS, oneOf } from './common.js';

export default {
  group: 'typography',
  fields: {
    fontFamily: CSS,
    fontSize: LENGTH,
    fontWeight: { type: 'fontWeight' },
    lineHeight: { type: 'lineHeight' },
    letterSpacing: LENGTH,
    align: oneOf('left', 'center', 'right', 'justify', 'start', 'end'),
    textWidth: LENGTH
  }
};
