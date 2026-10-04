// LayaPhi owns WHAT components exist. This adapter ingests its layout spec and verifies
// that DesiPhi never removed, replaced, retyped or reordered those components.

const ID_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;

export function ingestLayout(layoutSpec) {
  const errors = [];
  if (!layoutSpec || typeof layoutSpec !== 'object' || Array.isArray(layoutSpec)) {
    return { ok: false, errors: [{ code: 'INVALID_LAYOUT', message: 'Layout spec must be an object' }] };
  }
  if (typeof layoutSpec.pageType !== 'string' || !layoutSpec.pageType) {
    errors.push({ code: 'INVALID_LAYOUT', message: 'pageType must be a non-empty string' });
  }
  if (!Array.isArray(layoutSpec.components) || layoutSpec.components.length === 0) {
    errors.push({ code: 'INVALID_LAYOUT', message: 'components must be a non-empty array' });
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

export const createLayaPhiAdapter = () => ({ ingest: ingestLayout, verify: verifyPreserved });
