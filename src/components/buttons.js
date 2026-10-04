// Interactive controls (buttons, quiz answers) get touch-target defaults.
export const types = ['button', 'cta', 'quiz'];
export const defaults = (tokens) => ({
  sizing: { minHeight: '44px', minWidth: '44px' },
  colors: { background: tokens.colors?.accent, foreground: tokens.colors?.background },
  shape: { radius: tokens.shape?.radius },
  motion: { hover: 'lift' }
});
