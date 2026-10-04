// Shared primitives for the normalized control models.
// Each control module declares `fields` using the spec types validated here.

const LENGTH_RE = /^-?\d+(\.\d+)?(px|rem|em|%|vh|vw|vmin|vmax|dvh|svh|ch|fr)?$/;
const FUNC_RE = /^(calc|clamp|min|max)\([0-9a-z%+\-*/.,() ]+\)$/i;
const COLOR_FUNC_RE = /^(rgb|rgba|hsl|hsla)\([0-9a-z%., /-]+\)$/i;
const HEX_RE = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RATIO_RE = /^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/;
const FORBIDDEN_CSS = /[;{}<>\\]|url\(|expression\(|@import/i;

export const isPlain = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v) &&
  Object.getPrototypeOf(v) === Object.prototype;

const isLengthToken = (v) =>
  v === 'auto' || v === 'none' || LENGTH_RE.test(v) || FUNC_RE.test(v);

export function isLength(v) {
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v !== 'string') return false;
  const s = v.trim();
  if (FUNC_RE.test(s)) return true;
  const parts = s.split(/\s+/);
  return parts.length >= 1 && parts.length <= 4 && parts.every(isLengthToken);
}

export function isColor(v) {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  return HEX_RE.test(s) || COLOR_FUNC_RE.test(s) ||
    s === 'transparent' || s === 'currentColor';
}

export function isSafeCss(v) {
  return typeof v === 'string' && v.length > 0 && v.length <= 400 && !FORBIDDEN_CSS.test(v);
}

/** Convert px / rem / em / number to pixels (1rem = 16px). Returns null if not absolute. */
export function toPx(v) {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^(-?\d+(?:\.\d+)?)(px|rem|em)?$/);
  if (!m) return null;
  return m[2] === 'rem' || m[2] === 'em' ? Number(m[1]) * 16 : Number(m[1]);
}

/** Returns an error message, or null when the value satisfies the spec. */
export function validateValue(spec, value) {
  switch (spec.type) {
    case 'length':
      return isLength(value) ? null : 'expected a CSS length (number, px/rem/%, auto)';
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) return 'expected a number';
      if (spec.int && !Number.isInteger(value)) return 'expected an integer';
      if (spec.min !== undefined && value < spec.min) return `must be >= ${spec.min}`;
      if (spec.max !== undefined && value > spec.max) return `must be <= ${spec.max}`;
      return null;
    case 'boolean':
      return typeof value === 'boolean' ? null : 'expected a boolean';
    case 'enum':
      return spec.values.includes(value) ? null : `expected one of: ${spec.values.join(', ')}`;
    case 'color':
      return isColor(value) ? null : 'expected a color (hex, rgb(), hsl())';
    case 'css':
      return isSafeCss(value) ? null : 'expected a safe, non-empty CSS value string';
    case 'ratio':
      if (typeof value === 'number') return value > 0 ? null : 'ratio must be > 0';
      return value === 'auto' || RATIO_RE.test(String(value)) ? null : 'expected ratio like "16/9"';
    case 'fontWeight':
      if (value === 'normal' || value === 'bold') return null;
      return Number.isInteger(value) && value >= 100 && value <= 900 ? null : 'expected 100-900, normal or bold';
    case 'lineHeight':
      if (typeof value === 'number') return value >= 0.5 && value <= 4 ? null : 'line height must be 0.5-4';
      return isLength(value) ? null : 'expected number or length';
    case 'object':
      return isPlain(value) ? null : 'expected an object';
    default:
      return `unknown spec type ${spec.type}`;
  }
}

export const num = (min, max, extra = {}) => ({ type: 'number', min, max, ...extra });
export const oneOf = (...values) => ({ type: 'enum', values });
export const LENGTH = { type: 'length' };
export const COLOR = { type: 'color' };
export const CSS = { type: 'css' };
export const BOOL = { type: 'boolean' };
