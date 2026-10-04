// The DOM here is only a *view* of the design; the engine's design object is the source of truth.
import { createEngine, listThemes, resolveStyle, listDesignTargets } from '../src/index.js';
import { BREAKPOINTS } from '../src/controls/responsive.js';

const layoutSpec = {
  pageType: 'education',
  components: [
    { id: 'hero', type: 'hero', title: 'The Roman Republic', subtitle: 'How a city became a power' },
    { id: 'overview', type: 'article', heading: 'Overview', body: 'Rome grew from a small settlement into a republic governed by elected officials and a senate.' },
    { id: 'timeline', type: 'timeline', heading: 'Timeline', items: [['509 BCE', 'Republic founded'], ['264 BCE', 'Punic Wars begin'], ['27 BCE', 'Empire begins']] },
    { id: 'lesson-cards', type: 'card-grid', heading: 'Lessons', items: [
      { id: 'card-1', title: 'Government', description: 'Senate and consuls', image: { id: 'image', role: 'image' }, headingTarget: { id: 'heading', role: 'heading' }, bodyTarget: { id: 'body', role: 'body' }, button: { id: 'button', role: 'button', label: 'Explore' } },
      { id: 'card-2', title: 'Army', description: 'The legions', image: { id: 'image', role: 'image' }, headingTarget: { id: 'heading', role: 'heading' }, bodyTarget: { id: 'body', role: 'body' }, button: { id: 'button', role: 'button', label: 'Explore' } },
      { id: 'card-3', title: 'Daily life', description: 'Forum and farms', image: { id: 'image', role: 'image' }, headingTarget: { id: 'heading', role: 'heading' }, bodyTarget: { id: 'body', role: 'body' }, button: { id: 'button', role: 'button', label: 'Explore' } }
    ] },
    { id: 'quiz', type: 'quiz', heading: 'Quick quiz', question: 'When was the Republic founded?', options: ['509 BCE', '27 BCE'] },
    { id: 'sources', type: 'sources', heading: 'Sources', items: ['Livy, Ab Urbe Condita', 'Polybius, Histories'] }
  ]
};

const engine = createEngine();
engine.createDesign(layoutSpec, { theme: 'educational' });
const $ = (id) => document.getElementById(id);
const px = (n) => `${n}px`;

function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

function cssFor(s) {
  const o = {};
  const put = (k, v) => { if (v !== undefined && v !== null) o[k] = typeof v === 'number' && !['opacity', 'zIndex', 'fontWeight', 'lineHeight'].includes(k) ? px(v) : v; };
  const t = s.typography || {}, c = s.colors || {}, z = s.sizing || {}, sh = s.shape || {}, sp = s.spacing || {}, ef = s.effects || {};
  put('fontFamily', t.fontFamily); put('fontSize', t.fontSize); put('fontWeight', t.fontWeight);
  put('lineHeight', t.lineHeight); put('letterSpacing', t.letterSpacing); put('textAlign', t.align);
  put('color', c.foreground); put('background', c.gradient || c.background); put('opacity', c.opacity);
  put('minHeight', z.minHeight); put('height', z.height); put('maxWidth', z.maxWidth); put('aspectRatio', z.aspectRatio);
  put('borderRadius', sh.radius);
  if (sh.border) { put('borderWidth', sh.border.width); put('borderStyle', sh.border.style); put('borderColor', sh.border.color); }
  put('padding', sp.padding); put('margin', sp.margin);
  put('boxShadow', ef.shadow);
  if (ef.glass) { put('backdropFilter', 'blur(12px)'); put('backgroundColor', 'rgba(255,255,255,.35)'); }
  return o;
}

function bodyFor(comp) {
  const l = comp.layout;
  const frag = document.createDocumentFragment();
  if (l.title) frag.append(el('h2', l.title));
  if (l.subtitle) frag.append(el('p', l.subtitle));
  if (l.heading) frag.append(el('h3', l.heading));
  if (l.body) frag.append(el('p', l.body));
  if (comp.type === 'timeline') {
    const ul = el('ul', undefined, 'timeline');
    l.items.forEach(([y, t]) => ul.append(el('li', `${y} - ${t}`)));
    frag.append(ul);
  } else if (comp.type === 'card-grid') {
    const g = el('div', undefined, 'cards');
    l.items.forEach((item, index) => {
      const title = Array.isArray(item) ? item[0] : item.title;
      const description = Array.isArray(item) ? item[1] : item.description;
      const nested = Array.isArray(item) ? null : item;
      const path = `${comp.id}/${nested?.id || `card-${index + 1}`}`;
      const card = el('div', undefined, 'card');
      card.dataset.target = path;
      if (nested?.image) {
        const image = el('div', 'Image target', 'image-target');
        image.dataset.target = `${path}/${nested.image.id}`;
        card.append(image);
      }
      const heading = el('strong', title);
      if (nested?.headingTarget) heading.dataset.target = `${path}/${nested.headingTarget.id}`;
      const body = el('p', description);
      if (nested?.bodyTarget) body.dataset.target = `${path}/${nested.bodyTarget.id}`;
      card.append(heading, body);
      if (nested?.button) {
        const button = el('button', nested.button.label);
        button.dataset.target = `${path}/${nested.button.id}`;
        card.append(button);
      }
      g.append(card);
    });
    frag.append(g);
  } else if (comp.type === 'quiz') {
    frag.append(el('p', l.question));
    l.options.forEach((o) => frag.append(el('button', o)));
  } else if (comp.type === 'sources') {
    const ul = el('ul'); l.items.forEach((i) => ul.append(el('li', i))); frag.append(ul);
  }
  return frag;
}

function render() {
  const d = engine.getDesign();
  const bp = $('mobile').checked ? 'mobile' : ($('breakpoint').value === 'base' ? 'desktop' : $('breakpoint').value);
  const frame = $('frame');
  frame.classList.toggle('mobile', bp === 'mobile');
  frame.style.width = bp === 'mobile' ? px(BREAKPOINTS[0].previewWidth) : '100%';
  const page = $('page');
  page.replaceChildren();
  for (const id of d.order) {
    const comp = d.components[id];
    const s = resolveStyle(d, id, bp);
    const node = el('section', undefined, 'block');
    node.dataset.id = id;
    node.dataset.target = id;
    node.dataset.locked = String(!!d.locks.components[id]?.locked);
    Object.assign(node.style, cssFor(s));
    if (s.motion?.enabled && s.motion.entrance !== 'none') node.classList.add(`animate-${s.motion.entrance}`);
    node.append(bodyFor(comp));
    page.append(node);
    node.querySelectorAll('[data-target]').forEach((child) => {
      if (child.dataset.target === id) return;
      const targetStyle = resolveStyle(d, child.dataset.target, bp);
      if (targetStyle) Object.assign(child.style, cssFor(targetStyle));
    });
  }
  const selected = $('target').value || 'hero';
  const selectedInfo = listDesignTargets(d).find((target) => target.path === selected);
  $('inspector').textContent = JSON.stringify({
    target: selectedInfo,
    locked: !!d.locks.components[selected]?.locked,
    designStyle: selectedInfo ? (selectedInfo.path.includes('/')
      ? d.components[selectedInfo.componentId].targets[selectedInfo.path].style
      : d.components[selected].style) : null,
    resolved: resolveStyle(d, selected, bp)
  }, null, 2);
  $('undo').disabled = !engine.canUndo();
  $('redo').disabled = !engine.canRedo();
  const report = engine.validateDesign();
  const ul = $('warnings');
  ul.replaceChildren(...report.warnings.slice(0, 6).map((w) => el('li', `${w.componentId} (${w.breakpoint}): ${w.message}`)));
}

function run(result, message) {
  $('status').textContent = result.ok ? message || 'OK' : `Rejected: ${result.errors.map((e) => e.message).join('; ')}`;
  render();
}

const themeSel = $('theme');
listThemes().forEach((t) => themeSel.append(new Option(t, t)));
function refreshTargets() {
  const targets = listDesignTargets(engine.getDesign());
  for (const selectId of ['target', 'copyTarget']) {
    const select = $(selectId);
    const current = select.value;
    select.replaceChildren(...targets.map((target) => new Option(`${target.path} (${target.role || target.type})`, target.path)));
    if (targets.some((target) => target.path === current)) select.value = current;
  }
}
refreshTargets();
const applyTarget = (changes) => {
  const breakpoint = $('breakpoint').value;
  run(breakpoint === 'base' ? engine.updateComponent($('target').value, changes) :
    engine.setResponsiveOverride($('target').value, breakpoint, changes));
};

themeSel.onchange = () => run(engine.applyTheme(themeSel.value), `Theme: ${themeSel.value}`);
$('fontSize').oninput = (e) => applyTarget({ typography: { fontSize: px(e.target.value) } });
$('fontFamily').onchange = (e) => applyTarget({ typography: { fontFamily: e.target.value } });
$('cardRadius').oninput = (e) => applyTarget({ shape: { radius: px(e.target.value) } });
$('spacing').oninput = (e) => applyTarget({ spacing: { padding: px(e.target.value), gap: px(e.target.value) } });
$('heroHeight').oninput = (e) => applyTarget({ sizing: { height: px(e.target.value) } });
$('accent').onchange = (e) => applyTarget({ colors: { accent: e.target.value } });
$('glass').onchange = (e) => applyTarget({ effects: { glass: e.target.checked } });
$('intensity').oninput = (e) => run(engine.setDesignIntensity(Number(e.target.value)), 'Design intensity changed');
$('target').onchange = render;
$('breakpoint').onchange = render;
$('mobile').onchange = render;
$('animation').onchange = (e) => applyTarget({ motion: { enabled: e.target.checked } });
$('lock').onclick = () => run(engine.lockComponent($('target').value), 'Target locked');
$('unlock').onclick = () => run(engine.unlockComponent($('target').value), 'Target unlocked');
$('copy').onclick = () => run(engine.copyStyle($('target').value, $('copyTarget').value), 'Style copied');
$('resetProperty').onclick = () => {
  const breakpoint = $('breakpoint').value;
  run(engine.resetProperty($('target').value, 'sizing.height', breakpoint === 'base' ? null : breakpoint), 'Height reset');
};
$('undo').onclick = () => run(engine.undo(), 'Undone');
$('redo').onclick = () => run(engine.redo(), 'Redone');

render();
