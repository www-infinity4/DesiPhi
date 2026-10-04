export const types = ['image', 'video', 'media', 'gallery'];
export const defaults = () => ({
  sizing: { aspectRatio: '16/9', maxWidth: '100%' },
  imagery: { fit: 'cover', gif: { autoplay: false, loop: true } }
});
