import typography from './typography.js';
import colors from './colors.js';
import sizing from './sizing.js';
import shaping from './shaping.js';
import spacing from './spacing.js';
import positioning from './positioning.js';
import imagery from './imagery.js';
import effects from './effects.js';
import animation from './animation.js';
import accessibility from './accessibility.js';
import { validateValue, isPlain } from './common.js';

export const CONTROLS = Object.fromEntries(
  [typography, colors, sizing, shaping, spacing, positioning, imagery, effects, animation, accessibility]
    .map((c) => [c.group, c])
);
export const STYLE_GROUPS = Object.keys(CONTROLS);

/** Find the spec for a dotted path such as "shape.border.width". Group/object nodes included. */
export function getFieldSpec(path) {
  const [group, ...rest] = path.split('.');
  if (!CONTROLS[group]) return null;
  let node = { type: 'object', fields: CONTROLS[group].fields };
  for (const seg of rest) {
    if (node.type !== 'object' || !Object.hasOwn(node.fields, seg)) return null;
    node = node.fields[seg];
  }
  return node;
}

export const isKnownPath = (path) => getFieldSpec(path) !== null;

/** Flatten nested changes to [path, value] leaves. null is a leaf (means "unset"). */
export function flattenChanges(changes, prefix = '') {
  const out = [];
  for (const [key, value] of Object.entries(changes)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlain(value)) out.push(...flattenChanges(value, path));
    else out.push([path, value]);
  }
  return out;
}

/** Validate one leaf change. Returns null or { code, message }. */
export function validateChange(path, value) {
  const spec = getFieldSpec(path);
  if (!spec) return { code: 'UNKNOWN_PROPERTY', message: `Unknown design property "${path}"` };
  if (value === null) return spec.type === 'object' && path.indexOf('.') === -1
    ? { code: 'INVALID_VALUE', message: `Cannot unset whole group "${path}"` } : null;
  if (spec.type === 'object' && path.indexOf('.') === -1) {
    return { code: 'INVALID_VALUE', message: `"${path}" needs concrete properties` };
  }
  const message = validateValue(spec, value);
  return message ? { code: 'INVALID_VALUE', message: `${path}: ${message}` } : null;
}
