// LayaPhi owns WHAT components exist. This adapter ingests its layout spec and verifies
// that DesiPhi never removed, replaced, retyped or reordered those components.

const ID_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;

export function ingestLayout(layoutSpec, { allowEmpty = false } = {}) {
  const errors = [];
  if (!layoutSpec || typeof layoutSpec !== 'object' || Array.isArray(layoutSpec)) {
    return { ok: false, errors: [{ code: 'INVALID_LAYOUT', message: 'Layout spec must be an object' }] };
  }
  if (typeof layoutSpec.pageType !== 'string' || !layoutSpec.pageType) {
    errors.push({ code: 'INVALID_LAYOUT', message: 'pageType must be a non-empty string' });
  }
  if (!Array.isArray(layoutSpec.components) || (!allowEmpty && layoutSpec.components.length === 0)) {
    errors.push({ code: 'INVALID_LAYOUT', message: `components must be ${allowEmpty ? 'an array' : 'a non-empty array'}` });
  } else {
    const seen = new Set();
    layoutSpec.components.forEach((c, i) => {
      if (!c || typeof c !== 'object' || Array.isArray(c)) {
        errors.push({ code: 'INVALID_LAYOUT', message: `components[${i}] must be an object` });
        return;
      }
      if (typeof c.id !== 'string' || !ID_RE.test(c.id)) {
        errors.push({ code: 'INVALID_LAYOUT', message: `components[${i}].id must match ${ID_RE}` });
      } else if (seen.has(c.id)) {
        errors.push({ code: 'INVALID_LAYOUT', message: `Duplicate component id "${c.id}"` });
      } else seen.add(c.id);
      if (typeof c.type !== 'string' || !c.type) {
        errors.push({ code: 'INVALID_LAYOUT', message: `components[${i}].type must be a non-empty string` });
      }
      if (typeof c.id === 'string') {
        const paths = new Set();
        const inspect = (value, parentPath, seen = new WeakSet()) => {
          if (!value || typeof value !== 'object' || seen.has(value)) return;
          seen.add(value);
          if (Array.isArray(value)) {
            value.forEach((item) => inspect(item, parentPath, seen));
            return;
          }
          let path = parentPath;
          if (typeof value.id === 'string' && value.id !== c.id) {
            if (!ID_RE.test(value.id)) errors.push({ code: 'INVALID_LAYOUT', message: `Nested target id "${value.id}" must match ${ID_RE}`, componentId: c.id });
            else {
              path = `${parentPath}/${value.id}`;
              if (paths.has(path)) errors.push({ code: 'INVALID_LAYOUT', message: `Duplicate nested target path "${path}"`, componentId: c.id });
              paths.add(path);
            }
          }
          for (const [key, child] of Object.entries(value)) if (key !== 'id') inspect(child, path, seen);
        };
        inspect(c, c.id);
      }
    });
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, layout: structuredClone(layoutSpec) };
}

/** Check a design still contains every LayaPhi component, same types, same order. */
export function verifyPreserved(layoutSpec, design) {
  const errors = [];
  const expected = layoutSpec.components.map((c) => ({ id: c.id, type: c.type }));
  expected.forEach((c, i) => {
    const rec = design.components?.[c.id];
    if (!rec) errors.push({ code: 'COMPONENT_MISSING', message: `Component "${c.id}" is missing`, componentId: c.id });
    else if (rec.type !== c.type) errors.push({ code: 'COMPONENT_CHANGED', message: `Component "${c.id}" changed type`, componentId: c.id });
    else if (design.order?.[i] !== c.id) errors.push({ code: 'COMPONENT_REORDERED', message: `Component "${c.id}" was reordered`, componentId: c.id });
  });
  if (design.order?.length !== expected.length) {
    errors.push({ code: 'COMPONENT_COUNT', message: 'Component count differs from LayaPhi layout' });
  }
  return { ok: errors.length === 0, errors };
}

/** Reconcile LayaPhi-owned structure while retaining design data only for exact stable paths. */
export function syncLayout(existingDesign, newLayoutSpec) {
  if (!existingDesign) {
    return { ok: false, errors: [{ code: 'NO_DESIGN', message: 'An existing design is required' }] };
  }
  const ing = ingestLayout(newLayoutSpec, { allowEmpty: true });
  if (!ing.ok) return ing;

  const next = structuredClone(existingDesign);
  const previous = new Map((existingDesign.source?.components || []).map((entry) => [entry.id, entry]));
  const incomingIds = new Set(ing.layout.components.map((entry) => entry.id));
  const added = [];
  const removed = (existingDesign.order || []).filter((id) => !incomingIds.has(id));
  const reordered = ing.layout.components
    .filter((entry, index) => existingDesign.order?.[index] !== entry.id)
    .map((entry) => entry.id);
  const preserved = [];
  const changed = [];
  const warnings = [];
  const components = {};

  for (const entry of ing.layout.components) {
    const id = entry.id;
    const old = existingDesign.components[id];
    if (!old) {
      components[id] = createComponentRecord(entry);
      added.push(id);
      continue;
    }
    const record = createComponentRecord(entry);
    record.style = structuredClone(old.style || {});
    record.responsive = structuredClone(old.responsive || record.responsive);
    for (const [path, target] of Object.entries(record.targets)) {
      const prior = old.targets?.[path];
      if (!prior) continue;
      target.style = structuredClone(prior.style || {});
      target.responsive = structuredClone(prior.responsive || target.responsive);
    }
    components[id] = record;
    const before = previous.get(id);
    if (before && before.type === entry.type && JSON.stringify(before.layout || {}) === JSON.stringify(record.layout)) preserved.push(id);
    else {
      changed.push(id);
      if (old.type !== entry.type) {
        warnings.push({ code: 'TYPE_CHANGED_STYLE_PRESERVED', componentId: id, message: `Preserved styling for "${id}" despite its LayaPhi type changing` });
      }
    }
  }

  const validLockTargets = new Set(Object.keys(components));
  for (const [id, comp] of Object.entries(components)) {
    for (const path of Object.keys(comp.targets || {})) validLockTargets.add(path);
  }
  const oldLocks = next.locks?.components || {};
  next.locks.components = Object.fromEntries(Object.entries(oldLocks).filter(([id]) => validLockTargets.has(id)));
  for (const [id, lock] of Object.entries(oldLocks)) {
    if (!validLockTargets.has(id) && (lock.locked || lock.properties?.length)) {
      warnings.push({
        code: removed.includes(id) ? 'REMOVED_LOCKED_COMPONENT' : 'REMOVED_LOCKED_TARGET',
        componentId: id,
        message: `Removed locks for deleted LayaPhi target "${id}"`
      });
    }
  }

  next.pageType = ing.layout.pageType;
  next.components = components;
  next.order = ing.layout.components.map((entry) => entry.id);
  next.source.components = ing.layout.components.map((entry) => {
    const { id, type, ...layout } = entry;
    return { id, type, layout: structuredClone(layout) };
  });
  return {
    ok: true,
    design: next,
    layout: ing.layout,
    report: { added, removed, preserved, changed, reordered, warnings }
  };
}

export const createLayaPhiAdapter = () => ({ ingest: ingestLayout, verify: verifyPreserved, sync: syncLayout });
import { createComponentRecord } from '../schema/component-schema.js';
