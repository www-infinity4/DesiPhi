import { SCHEMA_ID, SCHEMA_VERSION } from '../schema/design-schema.js';
import { BREAKPOINT_NAMES } from '../controls/responsive.js';
import { flattenChanges, validateChange, isKnownPath } from '../controls/index.js';
import { checkAccessibility } from '../controls/accessibility.js';
import { isPlain } from '../controls/common.js';
import { toPx } from '../controls/common.js';
import { contrastRatio } from '../controls/accessibility.js';
import { BREAKPOINTS } from '../controls/responsive.js';
import { getTargetRecord, resolveStyle } from './design-state.js';

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
    else if (c.layout && JSON.stringify(rec.layout) !== JSON.stringify(c.layout)) errors.push({ code: 'LAYOUT_CHANGED', message: `LayaPhi content or metadata for "${c.id}" differs from its source`, componentId: c.id });
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
    if (!isPlain(comp.targets || {})) errors.push({ code: 'INVALID_DESIGN', message: 'targets must be an object', componentId: id });
    for (const [path, target] of Object.entries(comp.targets || {})) {
      if (!path.startsWith(`${id}/`) || !isPlain(target) || typeof target.id !== 'string') {
        errors.push({ code: 'INVALID_TARGET', message: `Invalid nested target "${path}"`, componentId: id });
        continue;
      }
      checkStyle(target.style, errors, path, 'target.style');
      if (!isPlain(target.responsive)) errors.push({ code: 'INVALID_DESIGN', message: 'target responsive must be an object', componentId: path });
      else for (const [bp, ov] of Object.entries(target.responsive)) {
        if (!BREAKPOINT_NAMES.includes(bp)) errors.push({ code: 'INVALID_BREAKPOINT', message: `Unknown breakpoint "${bp}"`, componentId: path });
        else checkStyle(ov, errors, path, `target.responsive.${bp}`);
      }
    }
  }

  const lockPaths = [...(design.locks.global || [])];
  for (const [id, l] of Object.entries(design.locks.components || {})) {
    if (!getTargetRecord(design, id)) errors.push({ code: 'INVALID_LOCK', message: `Lock refers to unknown target "${id}"`, componentId: id });
    lockPaths.push(...(l.properties || []));
  }
  for (const p of lockPaths) if (!isKnownPath(p)) errors.push({ code: 'INVALID_LOCK', message: `Lock refers to unknown property "${p}"`, path: p });
  validatePolicy(design, errors);

  const warnings = errors.length ? [] : [...checkAccessibility(design), ...checkConstraints(design)];
  return { ok: errors.length === 0, errors, warnings };
}

function validatePolicy(design, errors) {
  const intensity = design.designIntensity;
  const categories = ['motion', 'decoration', 'depth', 'color', 'typography', 'imagery'];
  if (!isPlain(intensity) || !Number.isInteger(intensity.value) || intensity.value < 0 || intensity.value > 100 ||
      !isPlain(intensity.categories) || Object.entries(intensity.categories).some(([key, value]) =>
        !categories.includes(key) || !Number.isInteger(value) || value < 0 || value > 100)) {
    errors.push({ code: 'INVALID_INTENSITY', message: 'Design intensity and categories must be integers from 0 to 100' });
  }
  if (!isPlain(design.constraints)) {
    errors.push({ code: 'INVALID_CONSTRAINT', message: 'constraints must be an object' });
    return;
  }
  const allowed = ['maxAnimationsPerViewport', 'maximumTextWidth', 'minimumTouchTarget', 'minimumContrast',
    'maximumDecorativeLayers', 'avoidHorizontalOverflow', 'reducedMotion', 'preserveContentVisibility', 'preserveLayaPhiStructure'];
  for (const [key, value] of Object.entries(design.constraints)) {
    const booleanKeys = ['avoidHorizontalOverflow', 'reducedMotion', 'preserveContentVisibility', 'preserveLayaPhiStructure'];
    if (!allowed.includes(key)) errors.push({ code: 'INVALID_CONSTRAINT', message: `Unknown constraint "${key}"` });
    else if (booleanKeys.includes(key) && typeof value !== 'boolean') errors.push({ code: 'INVALID_CONSTRAINT', message: `Constraint "${key}" must be boolean` });
    else if (!booleanKeys.includes(key) && value !== null && (!Number.isFinite(value) || value < 0)) errors.push({ code: 'INVALID_CONSTRAINT', message: `Constraint "${key}" must be a non-negative number or null` });
    else if (['maxAnimationsPerViewport', 'maximumDecorativeLayers'].includes(key) && value !== null && !Number.isInteger(value)) errors.push({ code: 'INVALID_CONSTRAINT', message: `Constraint "${key}" must be an integer or null` });
    else if (key === 'minimumContrast' && value !== null && value > 21) errors.push({ code: 'INVALID_CONSTRAINT', message: 'minimumContrast must be at most 21' });
  }
}

function checkConstraints(design) {
  const warnings = [];
  const constraints = design.constraints || {};
  const targets = design.order.flatMap((id) => [
    id,
    ...Object.keys(design.components[id].targets || {})
  ]);
  const byBreakpoint = (bp) => targets.map((id) => ({ id, style: resolveStyle(design, id, bp) }));
  const breakpoints = [null, ...BREAKPOINT_NAMES];

  for (const bp of breakpoints) {
    const targetStyles = byBreakpoint(bp);
    const animations = targetStyles.filter(({ style }) => style?.motion?.enabled &&
      (style.motion.entrance !== 'none' || style.motion.exit !== 'none')).length;
    if (constraints.maxAnimationsPerViewport !== null && constraints.maxAnimationsPerViewport !== undefined &&
        animations > constraints.maxAnimationsPerViewport) {
      warnings.push({ code: 'CONSTRAINT_MAX_ANIMATIONS', breakpoint: bp || 'base', actual: animations, limit: constraints.maxAnimationsPerViewport, message: 'Maximum animations per viewport exceeded' });
    }
    let decorativeLayers = 0;
    for (const { id, style } of targetStyles) {
      const decor = style?.effects?.decorativeLayers || 0;
      decorativeLayers += decor;
      if (constraints.maximumTextWidth !== null && constraints.maximumTextWidth !== undefined) {
        const textWidth = style?.typography?.textWidth;
        const width = toPx(textWidth) ?? (typeof textWidth === 'string' && /ch$/.test(textWidth) ? Number.parseFloat(textWidth) * 8 : null);
        if (width !== null && width > constraints.maximumTextWidth) warnings.push({
          code: 'CONSTRAINT_TEXT_WIDTH', componentId: id, breakpoint: bp || 'base',
          actual: width, limit: constraints.maximumTextWidth, message: 'Maximum text width exceeded'
        });
      }
      if (constraints.minimumTouchTarget !== null && constraints.minimumTouchTarget !== undefined) {
        const size = toPx(style?.sizing?.minHeight) ?? toPx(style?.sizing?.height);
        if (size !== null && size < constraints.minimumTouchTarget) warnings.push({
          code: 'CONSTRAINT_TOUCH_TARGET', componentId: id, breakpoint: bp || 'base',
          actual: size, limit: constraints.minimumTouchTarget, message: 'Minimum touch target constraint violated'
        });
      }
      if (constraints.reducedMotion && style?.motion?.enabled && style.motion.reducedMotion !== 'disable') warnings.push({
        code: 'CONSTRAINT_REDUCED_MOTION', componentId: id, breakpoint: bp || 'base', message: 'Motion does not honor the reduced-motion constraint'
      });
      if (constraints.minimumContrast !== null && constraints.minimumContrast !== undefined) {
        const ratio = contrastRatio(style?.colors?.foreground, style?.colors?.background);
        if (ratio !== null && ratio < constraints.minimumContrast) warnings.push({
          code: 'CONSTRAINT_MINIMUM_CONTRAST', componentId: id, breakpoint: bp || 'base',
          actual: ratio, limit: constraints.minimumContrast, message: 'Minimum contrast constraint violated'
        });
      }
      if (constraints.avoidHorizontalOverflow) {
        const viewport = bp ? BREAKPOINTS.find((item) => item.name === bp)?.previewWidth : 1280;
        const width = toPx(style?.sizing?.width) ?? toPx(style?.sizing?.minWidth);
        if (width !== null && width > viewport) warnings.push({
          code: 'CONSTRAINT_HORIZONTAL_OVERFLOW', componentId: id, breakpoint: bp || 'base',
          actual: width, limit: viewport, message: 'Avoid-horizontal-overflow constraint violated'
        });
      }
      if (constraints.preserveContentVisibility &&
          (style?.colors?.opacity === 0 || style?.sizing?.height === '0px' || style?.sizing?.minHeight === '0px')) {
        warnings.push({ code: 'CONSTRAINT_CONTENT_VISIBILITY', componentId: id, breakpoint: bp || 'base', message: 'Content visibility constraint violated' });
      }
    }
    if (constraints.maximumDecorativeLayers !== null && constraints.maximumDecorativeLayers !== undefined &&
        decorativeLayers > constraints.maximumDecorativeLayers) warnings.push({
      code: 'CONSTRAINT_DECORATIVE_LAYERS', breakpoint: bp || 'base', actual: decorativeLayers,
      limit: constraints.maximumDecorativeLayers, message: 'Maximum decorative layers exceeded'
    });
  }
  if (constraints.preserveLayaPhiStructure && (!design.source?.components || design.order.length !== design.source.components.length)) {
    warnings.push({ code: 'CONSTRAINT_STRUCTURE', message: 'LayaPhi structure preservation constraint is violated' });
  }
  return warnings;
}
