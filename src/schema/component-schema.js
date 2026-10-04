import { BREAKPOINT_NAMES } from '../controls/responsive.js';

/**
 * Component record: LayaPhi-owned `id`, `type`, `layout` (any extra content/structure
 * fields LayaPhi supplied) plus DesiPhi-owned `style` and `responsive`.
 */
export function createComponentRecord(entry) {
  const { id, type, ...layout } = entry;
  return {
    id,
    type,
    layout: structuredClone(layout),
    style: {},
    responsive: Object.fromEntries(BREAKPOINT_NAMES.map((b) => [b, {}]))
  };
}
