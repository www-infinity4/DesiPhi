import { CSS, BOOL, num } from './common.js';

export default {
  group: 'accessibility',
  fields: {
    focusVisible: BOOL,
    focusOutline: CSS,
    minTouchTarget: num(0, 200)
  }
};

// ---- Validation hooks. They only REPORT; they never modify a design. ----
import { toPx } from './common.js';
import { resolveStyle } from '../engine/design-state.js';
import { BREAKPOINT_NAMES } from './responsive.js';

const INTERACTIVE = ['button', 'cta', 'quiz', 'navigation', 'nav', 'menu'];

export function parseColor(c) {
  if (typeof c !== 'string') return null;
  let m = c.trim().match(/^#([0-9a-f]{3,8})$/i);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((x) => x + x).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  m = c.trim().match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

const luminance = ([r, g, b]) => {
  const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

export function contrastRatio(fg, bg) {
  const a = parseColor(fg);
  const b = parseColor(bg);
  if (!a || !b) return null;
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Returns warnings [{ code, message, componentId, breakpoint, severity }]. */
export function checkAccessibility(design) {
  const out = [];
  const warn = (code, message, componentId, breakpoint) =>
    out.push({ code, message, componentId, breakpoint, severity: 'warning' });

  for (const id of design.order) {
    const comp = design.components[id];
    for (const bp of [null, ...BREAKPOINT_NAMES]) {
      if (bp && Object.keys(comp.responsive[bp] || {}).length === 0) continue;
      const s = resolveStyle(design, id, bp);
      const at = bp || 'base';
      const px = toPx(s.typography?.fontSize);
      const ratio = contrastRatio(s.colors?.foreground, s.colors?.background);
      if (ratio !== null) {
        const large = px !== null && (px >= 24 || (px >= 18.66 && Number(s.typography?.fontWeight) >= 700));
        const min = large ? 3 : 4.5;
        if (ratio < min) warn('LOW_CONTRAST', `Text contrast ${ratio.toFixed(2)}:1 is below ${min}:1`, id, at);
      }
      if (px !== null && px < 14) warn('SMALL_TEXT', `Font size ${px}px is small to read`, id, at);
      const lh = s.typography?.lineHeight;
      if (typeof lh === 'number' && lh < 1.3) warn('TIGHT_LINE_HEIGHT', `Line height ${lh} is tight`, id, at);
      const tw = String(s.typography?.textWidth ?? '');
      if (/ch$/.test(tw) && parseFloat(tw) > 90) warn('LONG_LINES', `Text width ${tw} produces hard-to-read lines`, id, at);
      if (INTERACTIVE.includes(comp.type)) {
        const min = s.accessibility?.minTouchTarget ?? 44;
        const h = toPx(s.sizing?.minHeight) ?? toPx(s.sizing?.height);
        if (h !== null && h < min) warn('SMALL_TOUCH_TARGET', `Interactive height ${h}px is below ${min}px`, id, at);
        const w = toPx(s.sizing?.minWidth) ?? toPx(s.sizing?.width);
        if (w !== null && w < min) warn('SMALL_TOUCH_TARGET', `Interactive width ${w}px is below ${min}px`, id, at);
      }
      if (s.accessibility?.focusVisible === false || /^none$|^0/.test(String(s.accessibility?.focusOutline ?? '')) ) {
        warn('NO_FOCUS_INDICATOR', 'Keyboard focus indicator is disabled', id, at);
      }
      const m = s.motion || {};
      const animated = m.enabled && ['entrance', 'exit', 'hover'].some((k) => m[k] && m[k] !== 'none');
      if (animated && m.reducedMotion === 'keep') {
        warn('NO_REDUCED_MOTION', 'Animation is kept when the user prefers reduced motion', id, at);
      }
      if (s.colors?.foreground && s.colors.foreground === s.colors.background) {
        warn('INVISIBLE_TEXT', 'Foreground and background colors are identical', id, at);
      }
      if ((s.positioning?.zIndex ?? 0) > 100) warn('HIGH_Z_INDEX', 'Very high z-index can break reading/focus order', id, at);
    }
    if (['image', 'video', 'media', 'gallery', 'character', 'mascot'].includes(comp.type) &&
        !comp.layout.alt && !comp.layout.decorative) {
      warn('MISSING_ALT', 'Media component has no alt text or decorative flag in the layout', id, 'base');
    }
  }
  return out;
}
