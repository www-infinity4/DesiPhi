import { LENGTH, num } from './common.js';

export default {
  group: 'sizing',
  fields: {
    width: LENGTH,
    height: LENGTH,
    minWidth: LENGTH,
    maxWidth: LENGTH,
    minHeight: LENGTH,
    maxHeight: LENGTH,
    aspectRatio: { type: 'ratio' },
    scale: num(0.1, 4)
  }
};
