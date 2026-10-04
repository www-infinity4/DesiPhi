import { LENGTH, CSS, BOOL, num, oneOf, ARRAY, ASSET } from './common.js';

export default {
  group: 'effects',
  fields: {
    shadow: CSS,
    blur: LENGTH,
    glass: BOOL,
    glow: CSS,
    texture: CSS,
    depth: num(0, 5),
    transform: CSS,
    rotation: num(-360, 360),
    scale: num(0.1, 4),
    overlay: CSS,
    overlays: ARRAY(ASSET),
    decorativeLayers: num(0, 20, { int: true }),
    decorationVisible: BOOL,
    badge: CSS,
    ribbon: CSS,
    divider: CSS,
    sticky: BOOL,
    floating: BOOL,
    scroll: oneOf('none', 'parallax', 'reveal', 'fade'),
    hover: oneOf('none', 'lift', 'scale', 'glow', 'tilt'),
    entrance: oneOf('none', 'fade', 'scale', 'slide-up', 'slide-in'),
    exit: oneOf('none', 'fade', 'scale', 'slide-down', 'slide-out'),
    shadowColor: CSS,
    glowColor: CSS
  }
};
