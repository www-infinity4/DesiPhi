import { resolveStyle } from '../engine/design-state.js';
import { BREAKPOINT_NAMES } from '../controls/responsive.js';

/**
 * Produce the specification Code Phi consumes. Self-contained: every component carries its
 * resolved style per breakpoint so Code Phi needs neither the engine nor DesiPhi internals.
 */
export function toCodePhiSpec(design) {
  return {
    schema: 'desiphi.codephi-spec',
    version: 2,
    pageType: design.pageType,
    theme: design.theme,
    tokens: structuredClone(design.tokens),
    resolvedThemeTokens: structuredClone(design.tokens),
    designIntensity: structuredClone(design.designIntensity),
    constraints: structuredClone(design.constraints),
    components: design.order.map((id) => {
      const c = design.components[id];
      const resolved = {
        base: resolveStyle(design, id, null),
        ...Object.fromEntries(BREAKPOINT_NAMES.map((bp) => [bp, resolveStyle(design, id, bp)]))
      };
      const targets = Object.keys(c.targets || {}).sort().map((path) => {
        const target = c.targets[path];
        const targetResolved = {
          base: resolveStyle(design, path, null),
          ...Object.fromEntries(BREAKPOINT_NAMES.map((bp) => [bp, resolveStyle(design, path, bp)]))
        };
        return {
          id: target.id,
          path,
          role: target.role,
          type: target.type,
          contentReference: { provider: 'LayaPhi', componentId: id, targetPath: path },
          style: structuredClone(target.style),
          responsive: structuredClone(target.responsive),
          resolved: targetResolved,
          accessibility: structuredClone(targetResolved.base.accessibility || {}),
          animationEffects: {
            motion: structuredClone(targetResolved.base.motion || {}),
            effects: structuredClone(targetResolved.base.effects || {})
          }
        };
      });
      return {
        identity: { id, type: c.type },
        id,
        type: c.type,
        contentReference: { provider: 'LayaPhi', componentId: id },
        layout: structuredClone(c.layout),
        style: structuredClone(c.style),
        responsive: structuredClone(c.responsive),
        resolved,
        baseVisualProperties: structuredClone(resolved.base),
        breakpointProperties: Object.fromEntries(BREAKPOINT_NAMES.map((bp) => [bp, structuredClone(resolved[bp])])),
        nestedTargets: targets,
        accessibility: {
          design: structuredClone(resolved.base.accessibility || {}),
          content: structuredClone(c.layout.accessibility || null)
        },
        animationEffects: {
          motion: structuredClone(resolved.base.motion || {}),
          effects: structuredClone(resolved.base.effects || {})
        }
      };
    })
  };
}

export const createCodePhiAdapter = () => ({ toSpec: toCodePhiSpec });
