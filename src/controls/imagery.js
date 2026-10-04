import { CSS, BOOL, oneOf } from './common.js';

export default {
  group: 'imagery',
  fields: {
    fit: oneOf('cover', 'contain', 'fill', 'none'),
    position: CSS,
    icon: CSS,
    character: CSS,
    gif: {
      type: 'object',
      fields: { autoplay: BOOL, loop: BOOL }
    }
  }
};
