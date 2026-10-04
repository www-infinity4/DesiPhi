import { COLOR, CSS, num } from './common.js';

export default {
  group: 'colors',
  fields: {
    foreground: COLOR,
    background: COLOR,
    surface: COLOR,
    accent: COLOR,
    border: COLOR,
    gradient: CSS,
    opacity: num(0, 1)
  }
};
