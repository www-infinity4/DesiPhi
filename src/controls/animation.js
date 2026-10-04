import { CSS, BOOL, num, oneOf } from './common.js';

const PRESET = oneOf('none', 'fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'scale', 'lift', 'glow');

export default {
  group: 'motion',
  fields: {
    enabled: BOOL,
    transition: CSS,
    duration: num(0, 5000),
    entrance: PRESET,
    exit: PRESET,
    hover: PRESET,
    scroll: oneOf('none', 'reveal', 'parallax', 'sticky'),
    // What to do when the user prefers reduced motion.
    reducedMotion: oneOf('disable', 'simplify', 'keep')
  }
};
