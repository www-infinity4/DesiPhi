// Token-derived defaults shared by every component type.
export function baseDefaults(tokens) {
  const t = (g) => structuredClone(tokens[g] || {});
  const colors = t('colors');
  return {
    colors: { foreground: colors.foreground, background: colors.background, accent: colors.accent, border: colors.border, opacity: 1 },
    typography: t('typography'),
    spacing: t('spacing'),
    shape: t('shape'),
    effects: t('effects'),
    motion: t('motion'),
    accessibility: { focusVisible: true, focusOutline: `2px solid ${colors.accent}`, minTouchTarget: 44 }
  };
}

export const surface = (tokens) => ({ colors: { background: tokens.colors?.surface } });
