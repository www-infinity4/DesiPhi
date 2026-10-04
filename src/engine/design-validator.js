import { SCHEMA_ID, SCHEMA_VERSION } from '../schema/design-schema.js';
import { BREAKPOINT_NAMES } from '../controls/responsive.js';
import { flattenChanges, validateChange, isKnownPath } from '../controls/index.js';
import { checkAccessibility } from '../controls/accessibility.js';
import { isPlain } from '../controls/common.js';

function checkStyle(style, errors, componentId, where) {
  if (!isPlain(style)) {
    errors.push({ code: 'INVALID_VALUE', message: `${where} must be an object`, componentId });
    return;
  }
  for (const [path, value] of flattenChanges(style)) {
    const err = validateChange(path, value);
    if (err || value === null) errors.push({ ...(err || { code: 'INVALID_VALUE', message: `${path}: null is not stored` }), componentId, path });
  }
}

/**
 * Validate a design. `errors` = invalid/corrupt design; `warnings` = accessibility reports.
 * Never mutates the design. `layoutVerifier` (optional) adds an external LayaPhi preservation check.
 */
export function validateDesign(design, { layoutVerifier } = {}) {
  const errors = [];
  if (!isPlain(design) || design.schema !== SCHEMA_ID) {
    return { ok: false, errors: [{ code: 'INVALID_DESIGN', message: `Not a ${SCHEMA_ID} document` }], warnings: [] };
  }
  if (design.version !== SCHEMA_VERSION) {
    errors.push({ code: 'INVALID_DESIGN', message: `Unsupported schema version ${design.version}` });
  }
  if (!isPlain(design.tokens) || !isPlain(design.components) || !Array.isArray(design.order) ||
      !isPlain(design.locks) || !Array.isArray(design.source?.components)) {
    errors.push({ code: 'INVALID_DESIGN', message: 'Missing tokens, components, order, locks or source' });
    return { ok: false, errors, warnings: [] };
  }
  checkStyle(design.tokens, errors, null, 'tokens');

  // LayaPhi components must be intact: same ids, types and order as recorded at creation.
  const src = design.source.components;
  src.forEach((c, i) => {
    const rec = design.components[c.id];
    if (!rec) errors.push({ code: 'COMPONENT_MISSING', message: `LayaPhi component "${c.id}" is missing`, componentId: c.id });
    else if (rec.type !== c.type) errors.push({ code: 'COMPONENT_CHANGED', message: `Component "${c.id}" changed type`, componentId: c.id });
    if (design.order[i] !== c.id) errors.push({ code: 'COMPONENT_REORDERED', message: `Component order differs at "${c.id}"`, componentId: c.id });
  });
  if (design.order.length !== src.length || Object.keys(design.components).length !== src.length) {
    errors.push({ code: 'COMPONENT_COUNT', message: 'Design components differ from the LayaPhi layout' });
  }
  if (layoutVerifier) errors.push(...layoutVerifier(design).errors);

  for (const [id, comp] of Object.entries(design.components)) {
    if (!isPlain(comp) || comp.id !== id) { errors.push({ code: 'INVALID_DESIGN', message: `Component key/id mismatch for "${id}"`, componentId: id }); continue; }
    checkStyle(comp.style, errors, id, 'style');
    if (!isPlain(comp.responsive)) { errors.push({ code: 'INVALID_DESIGN', message: 'responsive must be an object', componentId: id }); continue; }
    for (const [bp, ov] of Object.entries(comp.responsive)) {
      if (!BREAKPOINT_NAMES.includes(bp)) errors.push({ code: 'INVALID_BREAKPOINT', message: `Unknown breakpoint "${bp}"`, componentId: id });
      else checkStyle(ov, errors, id, `responsive.${bp}`);
    }
  }

  const lockPaths = [...(design.locks.global || [])];
  for (const [id, l] of Object.entries(design.locks.components || {})) {
    if (!design.components[id]) errors.push({ code: 'INVALID_LOCK', message: `Lock refers to unknown component "${id}"`, componentId: id });
    lockPaths.push(...(l.properties || []));
  }
  for (const p of lockPaths) if (!isKnownPath(p)) errors.push({ code: 'INVALID_LOCK', message: `Lock refers to unknown property "${p}"`, path: p });

  const warnings = errors.length ? [] : checkAccessibility(design);
  return { ok: errors.length === 0, errors, warnings };
}
