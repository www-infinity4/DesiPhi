import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, createCommandEngine, createLayaPhiAdapter, toCodePhiSpec, checkAccessibility } from '../src/index.js';
import { layout, makeEngine } from './fixtures.js';

test('LayaPhi components survive a DesiPhi pass', () => {
  const e = makeEngine();
  e.applyTheme('playful');
  e.updateComponent('hero', { sizing: { minHeight: '200px' } });
  e.setResponsiveOverride('quiz', 'mobile', { typography: { fontSize: '20px' } });
  const d = e.exportDesign();
  assert.deepEqual(createLayaPhiAdapter().verify(layout(), d), { ok: true, errors: [] });
  assert.equal(d.components['lesson-cards'].layout.items.length, 3);
  assert.equal(d.components.hero.layout.title, 'Ancient Rome');
});

test('structural keys and unknown components cannot be changed', () => {
  const e = makeEngine();
  const r1 = e.updateComponent('hero', { type: 'banner' });
  assert.equal(r1.ok, false);
  assert.equal(r1.errors[0].code, 'STRUCTURAL_PROTECTED');
  assert.equal(e.updateComponent('nope', { colors: { accent: '#fff' } }).errors[0].code, 'UNKNOWN_COMPONENT');
  assert.equal(e.exportDesign().components.hero.type, 'hero');
});

test('a single component can change without touching others', () => {
  const e = makeEngine();
  const before = e.exportDesign();
  assert.ok(e.updateComponent('lesson-cards', { shape: { radius: '32px' } }).ok);
  const after = e.exportDesign();
  assert.equal(after.components['lesson-cards'].style.shape.radius, '32px');
  for (const id of before.order.filter((i) => i !== 'lesson-cards')) {
    assert.deepEqual(after.components[id], before.components[id]);
  }
  assert.deepEqual(after.tokens, before.tokens);
});

test('invalid operations are rejected cleanly and change nothing', () => {
  const e = makeEngine();
  const before = e.exportDesign();
  const cases = [
    e.updateComponent('hero', { typography: { fontSize: 'huge' } }),
    e.updateComponent('hero', { colors: { opacity: 5 } }),
    e.updateComponent('hero', { bogus: { x: 1 } }),
    e.updateComponent('hero', { shape: { radius: 'url(x)' } }),
    e.updateComponent('hero', 'nonsense'),
    e.setResponsiveOverride('hero', 'watch', {}),
    e.applyTheme('does-not-exist'),
    e.applyTheme({ name: 'x', tokens: { content: { body: 'replaced' } } }),
    e.lockProperty('hero', 'not.a.property'),
    e.applyDesign({ nonsense: 1 })
  ];
  for (const r of cases) { assert.equal(r.ok, false); assert.ok(r.errors.length > 0); }
  assert.deepEqual(e.exportDesign(), before);
  assert.equal(e.canUndo(), false);
});

test('a bulk change with one bad entry applies nothing', () => {
  const e = makeEngine();
  const before = e.exportDesign();
  const r = e.applyDesign({ components: { hero: { colors: { accent: '#ff0000' } }, quiz: { colors: { opacity: 9 } } } });
  assert.equal(r.ok, false);
  assert.deepEqual(e.exportDesign(), before);
});

test('undo/redo restore prior designs', () => {
  const e = makeEngine();
  const original = e.exportDesign();
  e.updateComponent('hero', { sizing: { minHeight: '100px' } });
  const changed = e.exportDesign();
  assert.ok(e.undo().ok);
  assert.deepEqual(e.exportDesign(), original);
  assert.ok(e.redo().ok);
  assert.deepEqual(e.exportDesign(), changed);
  assert.equal(e.redo().errors[0].code, 'NOTHING_TO_REDO');
  e.undo();
  assert.equal(e.undo().errors[0].code, 'NOTHING_TO_UNDO');
});

test('theme change affects tokens, not content', () => {
  const e = makeEngine();
  const before = e.exportDesign();
  assert.ok(e.applyTheme('technical').ok);
  const after = e.exportDesign();
  assert.equal(after.theme, 'technical');
  assert.notDeepEqual(after.tokens, before.tokens);
  for (const id of before.order) assert.deepEqual(after.components[id].layout, before.components[id].layout);
  assert.equal(e.resolveStyle('overview').colors.background, '#0d1117');
});

test('export/import preserves the design', () => {
  const e = makeEngine();
  e.updateComponent('hero', { colors: { accent: '#ff5500' } });
  e.setResponsiveOverride('hero', 'mobile', { sizing: { minHeight: '180px' } });
  e.lockProperty('hero', 'colors.accent');
  const json = JSON.stringify(e.exportDesign());
  const e2 = createEngine();
  const r = e2.importDesign(json);
  assert.ok(r.ok);
  assert.deepEqual(e2.exportDesign(), JSON.parse(json));
  assert.equal(e2.updateComponent('hero', { colors: { accent: '#000000' } }).errors[0].code, 'LOCKED_PROPERTY');
});

test('import rejects corrupt or tampered designs', () => {
  const e = makeEngine();
  const d = e.exportDesign();
  const e2 = createEngine();
  assert.equal(e2.importDesign('{not json').ok, false);
  assert.equal(e2.importDesign({}).ok, false);
  delete d.components.quiz;
  const r = e2.importDesign(d);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((x) => x.code === 'COMPONENT_MISSING'));
});

test('snapshots restore an approved state, including locks', () => {
  const e = makeEngine();
  e.updateComponent('hero', { colors: { accent: '#00aa00' } });
  e.lockComponent('hero');
  const { snapshot } = e.snapshot('approved');
  e.unlockComponent('hero');
  e.updateComponent('hero', { colors: { accent: '#aa0000' } });
  assert.ok(e.restoreSnapshot(snapshot.id).ok);
  assert.equal(e.resolveStyle('hero').colors.accent, '#00aa00');
  assert.equal(e.updateComponent('hero', { colors: { accent: '#111111' } }).errors[0].code, 'LOCKED_COMPONENT');
  assert.equal(e.restoreSnapshot('missing').ok, false);
});

test('layout validation rejects bad LayaPhi specs', () => {
  const e = createEngine();
  assert.equal(e.createDesign(null).ok, false);
  assert.equal(e.createDesign({ pageType: 'x', components: [] }).ok, false);
  assert.equal(e.createDesign({ pageType: 'x', components: [{ id: 'a', type: 't' }, { id: 'a', type: 't' }] }).ok, false);
});

test('command engine applies deterministic operations atomically', () => {
  const e = makeEngine();
  const cmd = createCommandEngine(e);
  const ok = cmd.run([
    { op: 'updateComponent', componentId: 'hero', changes: { sizing: { minHeight: '200px' } } },
    { op: 'updateComponent', componentId: 'lesson-cards', changes: { shape: { radius: '24px' } } }
  ]);
  assert.ok(ok.ok);
  const before = e.exportDesign();
  const bad = cmd.run([
    { op: 'updateComponent', componentId: 'hero', changes: { sizing: { minHeight: '10px' } } },
    { op: 'updateComponent', componentId: 'ghost', changes: {} }
  ]);
  assert.equal(bad.ok, false);
  assert.deepEqual(e.exportDesign(), before);
  assert.equal(cmd.run({ op: 'explode' }).errors[0].code, 'UNKNOWN_OPERATION');
  assert.equal(cmd.run('Make the hero shorter.').errors[0].code, 'NO_INTERPRETER');
  const withAi = createCommandEngine(e, { interpreter: () => [{ op: 'updateComponent', componentId: 'hero', changes: { sizing: { minHeight: '150px' } } }] });
  assert.ok(withAi.run('Make the hero shorter.').ok);
  assert.equal(e.resolveStyle('hero').sizing.minHeight, '150px');
});

test('accessibility checks report but never rewrite the design', () => {
  const e = makeEngine();
  e.updateComponent('overview', { colors: { foreground: '#cccccc', background: '#ffffff' }, typography: { fontSize: '11px', lineHeight: 1.1 }, accessibility: { focusVisible: false } });
  e.updateComponent('quiz', { sizing: { minHeight: '20px' } });
  const before = e.exportDesign();
  const report = e.validateDesign();
  assert.ok(report.ok);
  const codes = report.warnings.map((w) => w.code);
  for (const c of ['LOW_CONTRAST', 'SMALL_TEXT', 'TIGHT_LINE_HEIGHT', 'NO_FOCUS_INDICATOR', 'SMALL_TOUCH_TARGET']) assert.ok(codes.includes(c), c);
  assert.deepEqual(e.exportDesign(), before);
  assert.deepEqual(checkAccessibility(makeEngine().exportDesign()).filter((w) => w.code === 'LOW_CONTRAST'), []);
});

test('Code Phi adapter emits a self-contained spec', () => {
  const e = makeEngine();
  e.setResponsiveOverride('hero', 'mobile', { sizing: { minHeight: '150px' } });
  const spec = toCodePhiSpec(e.exportDesign());
  assert.deepEqual(spec.components.map((c) => c.id), layout().components.map((c) => c.id));
  const hero = spec.components[0];
  assert.equal(hero.resolved.mobile.sizing.minHeight, '150px');
  assert.notEqual(hero.resolved.desktop.sizing.minHeight, '150px');
});
