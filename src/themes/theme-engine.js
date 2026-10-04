import { PRESETS } from './presets.js';
import { flattenChanges, validateChange } from '../controls/index.js';
import { isPlain } from '../controls/common.js';
import { TOKEN_GROUPS } from '../schema/design-schema.js';

const clone = (v) => structuredClone(v);

export const listThemes = () => Object.keys(PRESETS);

/**
 * Normalize a theme reference (preset name or { name, tokens }) into a theme.
 * Returns { ok, theme } or { ok:false, errors }.
 */
export function resolveTheme(theme, presets = PRESETS) {
  const t = typeof theme === 'string' ? presets[theme] : theme;
  if (!isPlain(t) || !isPlain(t.tokens) || typeof t.name !== 'string') {
    return { ok: false, errors: [{ code: 'INVALID_THEME', message: `Unknown or malformed theme "${typeof theme === 'string' ? theme : ''}"` }] };
  }
  const errors = [];
  for (const group of Object.keys(t.tokens)) {
    if (!TOKEN_GROUPS.includes(group)) {
      errors.push({ code: 'INVALID_THEME', message: `Theme token group "${group}" is not allowed (themes carry tokens only)` });
    }
  }
  for (const [path, value] of flattenChanges(t.tokens)) {
    const err = validateChange(path, value);
    if (err) errors.push({ ...err, path });
  }
  return errors.length ? { ok: false, errors } : { ok: true, theme: clone(t) };
}

/** Derive a new theme from an existing one without mutating it. */
export function extendTheme(base, name, overrides = {}) {
  const resolved = resolveTheme(base);
  if (!resolved.ok) return resolved;
  const merged = clone(resolved.theme.tokens);
  for (const [group, values] of Object.entries(overrides)) {
    merged[group] = { ...(merged[group] || {}), ...values };
  }
  return resolveTheme({ name, tokens: merged });
}
