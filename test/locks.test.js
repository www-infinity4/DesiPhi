import test from 'node:test';
import assert from 'node:assert/strict';
import { makeEngine } from './fixtures.js';

test('locked components cannot be modified', () => {
  const e = makeEngine();
  e.lockComponent('hero');
  const before = e.exportDesign();
  const r = e.updateComponent('hero', { colors: { accent: '#123456' } });
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].code, 'LOCKED_COMPONENT');
  assert.equal(e.setResponsiveOverride('hero', 'mobile', { spacing: { padding: '8px' } }).errors[0].code, 'LOCKED_COMPONENT');
  assert.deepEqual(e.exportDesign(), before);
  assert.ok(e.updateComponent('quiz', { colors: { accent: '#123456' } }).ok);
});

test('locked properties cannot be modified; others can', () => {
  const e = makeEngine();
  e.lockProperty('lesson-cards', 'shape.radius');
  const r = e.updateComponent('lesson-cards', { shape: { radius: '40px' } });
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].code, 'LOCKED_PROPERTY');
  assert.equal(r.errors[0].path, 'shape.radius');
  assert.ok(e.updateComponent('lesson-cards', { shape: { shape: 'pill' }, spacing: { gap: '30px' } }).ok);
});

test('a group-level property lock covers nested properties', () => {
  const e = makeEngine();
  e.lockProperty('hero', 'shape');
  assert.equal(e.updateComponent('hero', { shape: { border: { width: '4px' } } }).errors[0].code, 'LOCKED_PROPERTY');
});

test('a mixed change containing a locked property is rejected as a whole', () => {
  const e = makeEngine();
  e.lockProperty('hero', 'colors.accent');
  const r = e.updateComponent('hero', { colors: { accent: '#000000', background: '#eeeeee' } });
  assert.equal(r.ok, false);
  assert.equal(e.resolveStyle('hero').colors.background, '#ffffff');
});

test('global property locks apply to every component and theme tokens', () => {
  const e = makeEngine();
  e.lockGlobalProperty('typography.fontFamily');
  assert.equal(e.updateComponent('overview', { typography: { fontFamily: 'serif' } }).errors[0].code, 'LOCKED_GLOBAL');
  assert.equal(e.updateComponent('quiz', { typography: { fontFamily: 'serif' } }).errors[0].code, 'LOCKED_GLOBAL');
  const t = e.applyTheme('technical');
  assert.equal(t.ok, false);
  assert.equal(t.errors[0].code, 'LOCKED_GLOBAL');
  assert.equal(e.exportDesign().theme, 'educational');
  e.unlockGlobalProperty('typography.fontFamily');
  assert.ok(e.applyTheme('technical').ok);
});

test('theme changes do not alter locked components or locked properties', () => {
  const e = makeEngine();
  e.lockComponent('hero');
  e.lockProperty('overview', 'colors');
  const heroBefore = e.resolveStyle('hero');
  const overviewColors = e.resolveStyle('overview').colors;
  assert.ok(e.applyTheme('technical').ok);
  assert.deepEqual(e.resolveStyle('hero'), heroBefore);
  assert.deepEqual(e.resolveStyle('overview').colors, overviewColors);
  assert.equal(e.resolveStyle('quiz').colors.background, '#58a6ff');
});

test('unlocking permits changes again and locks are undoable', () => {
  const e = makeEngine();
  e.lockComponent('hero');
  e.unlockComponent('hero');
  assert.ok(e.updateComponent('hero', { colors: { accent: '#101010' } }).ok);
  e.undo(); e.undo();
  assert.equal(e.exportDesign().locks.components.hero.locked, true);
});
