import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEngine, createCommandEngine, listDesignTargets, resolveSelector, toCodePhiSpec,
  interpretDesignCommand, VISUAL_PRESETS
} from '../src/index.js';

const nestedLayout = () => ({
  pageType: 'education',
  components: [
    {
      id: 'lesson-cards', type: 'card-grid', heading: 'Lessons',
      items: [{ id: 'card-1', role: 'card', title: 'History', image: { id: 'image', role: 'image' }, heading: { id: 'heading', role: 'heading' } }]
    },
    { id: 'hero', type: 'hero', title: 'Start here' },
    { id: 'timeline', type: 'timeline', items: [] }
  ]
});

function makeNestedEngine() {
  const engine = createEngine();
  assert.equal(engine.createDesign(nestedLayout()).ok, true);
  return engine;
}

test('layout sync adds, removes, reorders, changes and preserves exact stable IDs', () => {
  const engine = makeNestedEngine();
  engine.updateComponent('hero', { colors: { accent: '#aa2200' } });
  engine.updateComponent('lesson-cards/card-1/image', { shape: { radius: '18px' } });
  engine.lockComponent('hero');
  const result = engine.syncLayout({
    pageType: 'lesson',
    components: [
      { id: 'timeline', type: 'timeline', items: [] },
      { id: 'hero', type: 'banner', title: 'Updated heading', metadata: { revision: 2 } },
      { id: 'lesson-cards', type: 'card-grid', heading: 'New lessons', items: [
        { id: 'card-1', role: 'card', title: 'Updated title', image: { id: 'image', role: 'image' } },
        { id: 'card-2', role: 'card', title: 'New card', image: { id: 'image', role: 'image' } }
      ] },
      { id: 'sources', type: 'sources', items: [] }
    ]
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.report.added, ['sources']);
  assert.deepEqual(result.report.removed, []);
  assert.ok(result.report.reordered.includes('timeline'));
  assert.ok(result.report.changed.includes('hero'));
  assert.ok(result.report.changed.includes('lesson-cards'));
  assert.deepEqual(engine.exportDesign().order, ['timeline', 'hero', 'lesson-cards', 'sources']);
  assert.equal(engine.exportDesign().components.hero.type, 'banner');
  assert.equal(engine.exportDesign().components.hero.style.colors.accent, '#aa2200');
  assert.equal(engine.exportDesign().locks.components.hero.locked, true);
  assert.equal(engine.resolveStyle('lesson-cards/card-1/image').shape.radius, '18px');
  assert.equal(engine.getComponent('lesson-cards/card-2/image').style.shape, undefined);
  assert.equal(engine.getComponent('lesson-cards/card-2/image').id, 'image');
  assert.ok(engine.validateDesign().ok);

  const removed = engine.syncLayout({ pageType: 'lesson', components: [{ id: 'timeline', type: 'timeline' }] });
  assert.equal(removed.ok, true);
  assert.deepEqual(removed.report.removed, ['hero', 'lesson-cards', 'sources']);
  assert.equal(removed.report.warnings.some((warning) => warning.code === 'REMOVED_LOCKED_COMPONENT'), true);
});

test('nested paths, style overrides and locks are independent of LayaPhi content', () => {
  const engine = makeNestedEngine();
  const before = engine.getComponent('lesson-cards').layout;
  assert.ok(engine.updateComponent('lesson-cards/card-1/image', { shape: { radius: '24px' } }).ok);
  assert.ok(engine.setResponsiveOverride('lesson-cards/card-1/image', 'mobile', { sizing: { height: '80px' } }).ok);
  assert.equal(engine.resolveStyle('lesson-cards/card-1/image', 'mobile').sizing.height, '80px');
  assert.ok(engine.lockProperty('lesson-cards/card-1/image', 'shape.radius').ok);
  assert.equal(engine.updateComponent('lesson-cards/card-1/image', { shape: { radius: '4px' } }).errors[0].code, 'LOCKED_PROPERTY');
  assert.ok(engine.lockComponent('lesson-cards').ok);
  assert.equal(engine.updateComponent('lesson-cards/card-1/heading', { typography: { fontSize: '20px' } }).errors[0].code, 'LOCKED_COMPONENT');
  assert.deepEqual(engine.getComponent('lesson-cards').layout, before);
});

test('safe selectors support IDs, paths, roles, types, bounded wildcards and bulk operations', () => {
  const engine = makeNestedEngine();
  assert.equal(resolveSelector(engine.getDesign(), '#hero').targets[0].path, 'hero');
  assert.equal(resolveSelector(engine.getDesign(), 'type:card-grid').targets[0].path, 'lesson-cards');
  assert.deepEqual(resolveSelector(engine.getDesign(), 'role:image').targets.map((target) => target.path), ['lesson-cards/card-1/image']);
  assert.deepEqual(resolveSelector(engine.getDesign(), '#lesson-cards/*/image').targets.map((target) => target.path), ['lesson-cards/card-1/image']);
  assert.equal(resolveSelector(engine.getDesign(), 'section > img').errors[0].code, 'INVALID_SELECTOR');
  assert.equal(resolveSelector(engine.getDesign(), '#hero:not(.x)').errors[0].code, 'INVALID_SELECTOR');
  const commands = createCommandEngine(engine);
  assert.equal(commands.run({ op: 'SET', selector: '*', path: 'effects.decorationVisible', value: false }).ok, true);
  assert.equal(engine.resolveStyle('lesson-cards/card-1/image').effects.decorationVisible, false);
});

test('design operations adjust, reset, copy and change only responsive overrides atomically', () => {
  const engine = makeNestedEngine();
  const commands = createCommandEngine(engine);
  assert.ok(commands.run({ op: 'SET', selector: '#hero', path: 'sizing.height', value: '420px' }).ok);
  assert.ok(commands.run({ op: 'ADJUST', selector: '#hero', path: 'sizing.height', delta: '-40px' }).ok);
  assert.equal(engine.resolveStyle('hero').sizing.height, '380px');
  assert.ok(commands.run({ op: 'COPY_STYLE', source: '#hero', destination: '#timeline' }).ok);
  assert.equal(engine.getComponent('timeline').style.sizing.height, '380px');
  assert.ok(commands.run({ op: 'RESPONSIVE_SET', selector: '#hero', breakpoint: 'mobile', path: 'sizing.height', value: '260px' }).ok);
  assert.equal(engine.resolveStyle('hero', 'mobile').sizing.height, '260px');
  assert.equal(engine.resolveStyle('hero', 'desktop').sizing.height, '380px');
  assert.ok(commands.run({ op: 'RESET_PROPERTY', selector: '#hero', path: 'sizing.height', breakpoint: 'mobile' }).ok);
  assert.equal(engine.exportDesign().components.hero.responsive.mobile.sizing, undefined);
  assert.ok(commands.run({ op: 'RESET', selector: '#hero', path: 'sizing.height' }).ok);
  assert.equal(engine.exportDesign().components.hero.style.sizing, undefined);
  const before = engine.exportDesign();
  assert.equal(commands.run({ op: 'ADJUST', selector: '#hero', path: 'sizing.height', delta: '-1em' }).ok, false);
  assert.deepEqual(engine.exportDesign(), before);
});

test('visual presets stay separate from themes and support component/role treatments', () => {
  const engine = makeNestedEngine();
  const commands = createCommandEngine(engine);
  assert.deepEqual(Object.keys(VISUAL_PRESETS), ['hero', 'article', 'card', 'card-grid', 'timeline', 'quiz', 'sources', 'navigation', 'media']);
  assert.deepEqual(Object.keys(VISUAL_PRESETS.card), ['clean', 'soft', 'bold', 'compact', 'editorial', 'immersive']);
  assert.ok(commands.run({ op: 'APPLY_PRESET', selector: 'role:card', preset: 'soft' }).ok);
  assert.equal(engine.resolveStyle('lesson-cards/card-1').shape.radius, '20px');
  assert.equal(engine.getDesign().theme, 'educational');
});

test('design intensity and constraints are metadata/policy and warnings never rewrite styles', () => {
  const engine = makeNestedEngine();
  assert.ok(engine.setConstraints({ preserveContentVisibility: false }).ok);
  engine.updateComponent('hero', {
    colors: { foreground: '#cccccc', background: '#ffffff', opacity: 0 },
    effects: { decorativeLayers: 3 },
    motion: { enabled: true, entrance: 'fade', reducedMotion: 'keep' },
    typography: { textWidth: '80ch' }
  });
  const style = engine.getComponent('hero').style;
  assert.ok(engine.setDesignIntensity(75, { motion: 20, imagery: 80 }).ok);
  assert.ok(engine.setConstraints({
    maxAnimationsPerViewport: 0, maximumTextWidth: 500, minimumContrast: 7,
    maximumDecorativeLayers: 1, reducedMotion: true, preserveContentVisibility: true
  }).ok);
  const before = engine.exportDesign();
  const warnings = engine.validateDesign().warnings;
  for (const code of ['CONSTRAINT_MAX_ANIMATIONS', 'CONSTRAINT_TEXT_WIDTH', 'CONSTRAINT_MINIMUM_CONTRAST',
    'CONSTRAINT_DECORATIVE_LAYERS', 'CONSTRAINT_REDUCED_MOTION', 'CONSTRAINT_CONTENT_VISIBILITY']) {
    assert.ok(warnings.some((warning) => warning.code === code), code);
  }
  assert.equal(before.designIntensity.value, 75);
  assert.deepEqual(engine.getComponent('hero').style, style);
  assert.deepEqual(engine.exportDesign(), before);
  const rejected = engine.updateComponent('hero', { effects: { decorativeLayers: 4 } });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.errors[0].code, 'CONSTRAINT_VIOLATION');
  assert.equal(engine.getComponent('hero').style.effects.decorativeLayers, 3);
});

test('Code Phi export includes deterministic renderer data for components and nested targets', () => {
  const engine = makeNestedEngine();
  engine.updateComponent('hero', { effects: { glow: '0 0 8px #ffffff' } });
  engine.setResponsiveOverride('hero', 'mobile', { sizing: { height: '240px' } });
  engine.updateComponent('lesson-cards/card-1/image', { imagery: { fit: 'cover', focalX: 25 } });
  const spec = toCodePhiSpec(engine.exportDesign());
  const hero = spec.components.find((component) => component.id === 'hero');
  const image = spec.components[0].nestedTargets.find((target) => target.path.endsWith('/image'));
  assert.deepEqual(hero.identity, { id: 'hero', type: 'hero' });
  assert.equal(hero.contentReference.provider, 'LayaPhi');
  assert.equal(hero.breakpointProperties.mobile.sizing.height, '240px');
  assert.equal(hero.animationEffects.effects.glow, '0 0 8px #ffffff');
  assert.equal(image.contentReference.targetPath, 'lesson-cards/card-1/image');
  assert.equal(image.resolved.base.imagery.focalX, 25);
  assert.ok(spec.resolvedThemeTokens.colors);
  assert.deepEqual(spec, toCodePhiSpec(engine.exportDesign()));
});

test('interpreter output is normalized data, cloned, and cannot mutate the design', () => {
  const engine = makeNestedEngine();
  const context = { design: engine.getDesign() };
  const interpreted = interpretDesignCommand('make hero tall', context, (_text, clonedContext) => {
    clonedContext.design.components.hero.style.colors = { accent: '#000000' };
    return [{ op: 'SET', selector: '#hero', path: 'sizing.height', value: '430px' }];
  });
  assert.ok(interpreted.ok);
  assert.notEqual(context.design.components.hero.style.colors?.accent, '#000000');
  assert.equal(engine.getComponent('hero').style.sizing, undefined);
  const commands = createCommandEngine(engine, {
    interpreter: () => [{ op: 'SET', selector: '#hero', path: 'sizing.height', value: '430px' }]
  });
  assert.ok(commands.run('make hero tall').ok);
  assert.equal(engine.resolveStyle('hero').sizing.height, '430px');
  const invalid = createCommandEngine(engine, { interpreter: () => [{ op: 'directMutation' }] });
  assert.equal(invalid.run('anything').ok, false);
  assert.equal(engine.updateComponent('hero', { imagery: { backgroundImage: 'javascript:alert(1)' } }).ok, false);
  assert.ok(listDesignTargets(engine.getDesign()).length >= 6);
});

test('schema v1 exports import through a non-destructive migration', () => {
  const current = makeNestedEngine().exportDesign();
  const legacy = structuredClone(current);
  legacy.version = 1;
  delete legacy.designIntensity;
  delete legacy.constraints;
  for (const component of Object.values(legacy.components)) delete component.targets;
  legacy.source.components = legacy.source.components.map(({ id, type }) => ({ id, type }));
  const restored = createEngine();
  assert.equal(restored.importDesign(legacy).ok, true);
  assert.equal(restored.exportDesign().version, 2);
  assert.equal(restored.getComponent('lesson-cards/card-1/image').id, 'image');
  assert.equal(restored.exportDesign().designIntensity.value, 50);
});
