// Breakpoint model. Mobile is listed first and is a first-class target.
export const BREAKPOINTS = [
  { name: 'mobile', minWidth: 0, maxWidth: 767, previewWidth: 375 },
  { name: 'tablet', minWidth: 768, maxWidth: 1023, previewWidth: 820 },
  { name: 'desktop', minWidth: 1024, maxWidth: 1439, previewWidth: 1280 },
  { name: 'wide', minWidth: 1440, maxWidth: Infinity, previewWidth: 1680 }
];

export const BREAKPOINT_NAMES = BREAKPOINTS.map((b) => b.name);
export const isBreakpoint = (name) => BREAKPOINT_NAMES.includes(name);

export function breakpointForWidth(width) {
  const bp = BREAKPOINTS.find((b) => width >= b.minWidth && width <= b.maxWidth);
  return bp ? bp.name : 'wide';
}
