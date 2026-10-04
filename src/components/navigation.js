export const types = ['navigation', 'nav', 'menu'];
export const defaults = (tokens) => ({
  sizing: { minHeight: '44px' },
  colors: { background: tokens.colors?.surface },
  positioning: { position: 'sticky', zIndex: 10 },
  spacing: { gap: tokens.spacing?.gap }
});
