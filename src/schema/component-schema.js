import { BREAKPOINT_NAMES } from '../controls/responsive.js';

/**
 * Component record: LayaPhi-owned `id`, `type`, `layout` (any extra content/structure
 * fields LayaPhi supplied) plus DesiPhi-owned `style` and `responsive`.
 */
export function createComponentRecord(entry) {
  const { id, type, ...layout } = entry;
  const targets = {};
  const collect = (value, parentPath, seen = new WeakSet()) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((item) => collect(item, parentPath, seen));
      return;
    }
    let path = parentPath;
    if (typeof value.id === 'string' && /^[A-Za-z][A-Za-z0-9_-]*$/.test(value.id) && value.id !== id) {
      path = `${parentPath}/${value.id}`;
      if (!targets[path]) {
        targets[path] = {
          id: value.id,
          role: typeof value.role === 'string' ? value.role : null,
          type: typeof value.type === 'string' ? value.type : null,
          style: {},
          responsive: Object.fromEntries(BREAKPOINT_NAMES.map((b) => [b, {}]))
        };
      }
    }
    for (const child of Object.values(value)) collect(child, path, seen);
  };
  collect(layout, id);
  return {
    id,
    type,
    layout: structuredClone(layout),
    style: {},
    responsive: Object.fromEntries(BREAKPOINT_NAMES.map((b) => [b, {}])),
    targets
  };
}
