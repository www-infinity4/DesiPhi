import { getTargetRecord } from './design-state.js';

export function listDesignTargets(design) {
  return design.order.flatMap((id) => {
    const component = design.components[id];
    return [{ path: id, id, type: component.type, role: component.layout?.role || null, componentId: id }]
      .concat(Object.entries(component.targets || {}).map(([path, target]) => ({
        path, id: target.id, type: target.type, role: target.role, componentId: id
      })));
  });
}

/** Resolve only DesiPhi's bounded selector syntax; this deliberately is not CSS. */
export function resolveSelector(design, selector) {
  if (typeof selector !== 'string' || !selector.trim()) {
    return { ok: false, errors: [{ code: 'INVALID_SELECTOR', message: 'Selector must be a non-empty string' }] };
  }
  const input = selector.trim();
  const targets = listDesignTargets(design);
  let matches = [];
  if (input === '*') matches = targets;
  else if (input.startsWith('type:')) {
    const value = input.slice(5);
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(value)) return invalidSelector(selector);
    matches = targets.filter((target) => target.type === value);
  } else if (input.startsWith('role:')) {
    const value = input.slice(5);
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(value)) return invalidSelector(selector);
    matches = targets.filter((target) => target.role === value);
  } else {
    const path = input.startsWith('#') ? input.slice(1) : input;
    if (!/^[A-Za-z][A-Za-z0-9_*-]*(?:\/[A-Za-z][A-Za-z0-9_*-]*)*$/.test(path) ||
        path.split('/').some((part) => part.includes('*') && part !== '*')) return invalidSelector(selector);
    const exact = getTargetRecord(design, path);
    if (exact) matches = targets.filter((target) => target.path === path);
    else if (path.includes('*')) {
      const pattern = new RegExp(`^${path.split('/').map((part) => part === '*' ? '[A-Za-z][A-Za-z0-9_-]*' : escapeRegex(part)).join('/')}$`);
      matches = targets.filter((target) => pattern.test(target.path));
    }
  }
  if (!matches.length) return { ok: false, errors: [{ code: 'NO_SELECTOR_MATCH', message: `Selector "${selector}" matched no design targets` }] };
  return { ok: true, targets: matches };
}

function invalidSelector(selector) {
  return { ok: false, errors: [{ code: 'INVALID_SELECTOR', message: `Unsupported selector "${selector}"` }] };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
