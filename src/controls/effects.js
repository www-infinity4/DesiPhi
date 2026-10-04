import { LENGTH, CSS, BOOL, num } from './common.js';

export default {
  group: 'effects',
  fields: {
    shadow: CSS,
    blur: LENGTH,
    glass: BOOL,
    glow: CSS,
    texture: CSS,
    depth: num(0, 5)
  }
};
