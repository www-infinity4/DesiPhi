import { CSS, BOOL, ASSET, num, oneOf } from './common.js';

export default {
  group: 'imagery',
  fields: {
    fit: oneOf('cover', 'contain', 'fill', 'none'),
    position: CSS,
    crop: oneOf('none', 'cover', 'contain', 'fill'),
    focalX: num(0, 100),
    focalY: num(0, 100),
    backgroundImage: ASSET,
    icon: CSS,
    iconPlacement: oneOf('start', 'end', 'top', 'bottom', 'overlay'),
    character: CSS,
    characterPlacement: oneOf('start', 'end', 'top', 'bottom', 'overlay'),
    animatedMedia: oneOf('none', 'gif', 'video', 'lottie'),
    mediaAsset: ASSET,
    gif: {
      type: 'object',
      fields: { autoplay: BOOL, loop: BOOL }
    }
  }
};
