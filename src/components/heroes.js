export const types = ['hero', 'banner'];
export const defaults = (tokens) => ({
  sizing: { minHeight: '320px' },
  typography: { align: 'center', fontSize: '24px', fontWeight: 700 },
  colors: { background: tokens.colors?.surface },
  spacing: { padding: '40px' }
});
