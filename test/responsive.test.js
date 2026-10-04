import test from 'node:test';
import assert from 'node:assert/strict';
import { BREAKPOINT_NAMES, breakpointForWidth } from '../src/index.js';
import { makeEngine } from './fixtures.js';

test('breakpoints start with mobile, tablet, desktop, wide', () => {
  assert.deepEqual(BREAKPOINT_NAMES, ['mobile', 'tablet', 'desktop', 'wide']);
  assert.equal(breakpointForWidth(375), 'mobile');
  assert.equal(breakpointForWidth(800), 'tablet');
  assert.equal(breakpointForWidth(1200), 'desktop');
  assert.equal(breakpointForWidth(2000), 'wide');
});

test('responsive overrides never overwrite base values', () => {
  const e = makeEngine();
  e.updateComponent('hero', { typography: { fontSize: '30px' } });
  const baseBefore = e.exportDesign().components.hero.style;
  assert.ok(e.setResponsiveOverride('hero', 'mobile', { typography: { fontSize: '20px' } }).ok);
  const d = e.exportDesign();
  assert.deepEqual(d.components.hero.style, baseBefore);
  assert.equal(d.components.hero.responsive.mobile.typography.fontSize, '20px');
  assert.equal(e.resolveStyle('hero', 'mobile').typography.fontSize, '20px');
  assert.equal(e.resolveStyle('hero', 'desktop').typography.fontSize, '30px');
  assert.equal(e.resolveStyle('hero').typography.fontSize, '30px');
});

test('overrides only store the differing properties', () => {
  const e = makeEngine();
  e.setResponsiveOverride('lesson-cards', 'mobile', { spacing: { gap: '8px' } });
  assert.deepEqual(e.exportDesign().components['lesson-cards'].responsive.mobile, { spacing: { gap: '8px' } });
  assert.equal(e.resolveStyle('lesson-cards', 'mobile').shape.radius, e.resolveStyle('lesson-cards').shape.radius);
});

test('null removes an override; invalid breakpoint is rejected', () => {
  const e = makeEngine();
  e.setResponsiveOverride('hero', 'tablet', { spacing: { padding: '10px' } });
  e.setResponsiveOverride('hero', 'tablet', { spacing: { padding: null } });
  assert.deepEqual(e.exportDesign().components.hero.responsive.tablet, {});
  assert.equal(e.setResponsiveOverride('hero', 'phone', {}).errors[0].code, 'INVALID_BREAKPOINT');
});

test('mobile touch-target regression is reported per breakpoint', () => {
  const e = makeEngine();
  e.setResponsiveOverride('quiz', 'mobile', { sizing: { minHeight: '24px' } });
  const w = e.validateDesign().warnings.filter((x) => x.code === 'SMALL_TOUCH_TARGET');
  assert.deepEqual(w.map((x) => x.breakpoint), ['mobile']);
});
