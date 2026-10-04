import { resolveStyle } from '../engine/design-state.js';
import { BREAKPOINT_NAMES } from '../controls/responsive.js';

/**
 * Produce the specification Code Phi consumes. Self-contained: every component carries its
 * resolved style per breakpoint so Code Phi needs neither the engine nor DesiPhi internals.
 */
export function toCodePhiSpec(design) {
  return {
    schema: 'desiphi.codephi-spec',
    version: 1,
    pageType: design.pageType,
    theme: design.theme,
    tokens: structuredClone(design.tokens),
    components: design.order.map((id) => {
      const c = design.components[id];
      return {
        id,
        type: c.type,
        layout: structuredClone(c.layout),
        style: structuredClone(c.style),
        responsive: structuredClone(c.responsive),
        resolved: {
          base: resolveStyle(design, id, null),
          ...Object.fromEntries(BREAKPOINT_NAMES.map((bp) => [bp, resolveStyle(design, id, bp)]))
        }
      };
    })
  };
}

export const createCodePhiAdapter = () => ({ toSpec: toCodePhiSpec });
