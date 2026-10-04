// The DOM here is only a *view* of the design; the engine's design object is the source of truth.
import { createEngine, listThemes, resolveStyle } from '../src/index.js';
import { BREAKPOINTS } from '../src/controls/responsive.js';

const layoutSpec = {
  pageType: 'education',
  components: [
    { id: 'hero', type: 'hero', title: 'The Roman Republic', subtitle: 'How a city became a power' },
    { id: 'overview', type: 'article', heading: 'Overview', body: 'Rome grew from a small settlement into a republic governed by elected officials and a senate.' },
    { id: 'timeline', type: 'timeline', heading: 'Timeline', items: [['509 BCE', 'Republic founded'], ['264 BCE', 'Punic Wars begin'], ['27 BCE', 'Empire begins']] },
    { id: 'lesson-cards', type: 'card-grid', heading: 'Lessons', items: [['Government', 'Senate and consuls'], ['Army', 'The legions'], ['Daily life', 'Forum and farms']] },
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
    l.items.forEach(([a, b]) => { const c = el('div', undefined, 'card'); c.append(el('strong', a), el('p', b)); g.append(c); });
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
  const bp = $('mobile').checked ? 'mobile' : 'desktop';
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
    node.dataset.locked = String(!!d.locks.components[id]?.locked);
    Object.assign(node.style, cssFor(s));
    if (s.motion?.enabled && s.motion.entrance !== 'none') node.classList.add(`animate-${s.motion.entrance}`);
    node.append(bodyFor(comp));
    page.append(node);
    if (comp.type === 'card-grid') {
      node.querySelectorAll('.card').forEach((c) => { c.style.borderRadius = s.shape?.radius ?? ''; c.style.gap = s.spacing?.gap ?? ''; });
      node.querySelector('.cards').style.gap = s.spacing?.gap ?? '';
    }
  }
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
engine.getDesign().order.forEach((id) => $('lockTarget').append(new Option(id, id)));

themeSel.onchange = () => run(engine.applyTheme(themeSel.value), `Theme: ${themeSel.value}`);
$('fontSize').onchange = (e) => run(engine.applyDesign({ components: { overview: { typography: { fontSize: px(e.target.value) } } } }), 'Font size changed');
$('cardRadius').onchange = (e) => run(engine.updateComponent('lesson-cards', { shape: { radius: px(e.target.value) } }));
$('spacing').onchange = (e) => run(engine.applyDesign({ components: { overview: { spacing: { padding: px(e.target.value) } }, 'lesson-cards': { spacing: { gap: px(e.target.value) } } } }));
$('heroHeight').onchange = (e) => run(engine.updateComponent('hero', { sizing: { minHeight: px(e.target.value) } }));
$('mobile').onchange = render;
$('animation').onchange = (e) => {
  const comps = Object.fromEntries(engine.getDesign().order.map((id) => [id, { motion: { enabled: e.target.checked } }]));
  run(engine.applyDesign({ components: comps }), `Animation ${e.target.checked ? 'on' : 'off'}`);
};
$('lock').onclick = () => {
  const id = $('lockTarget').value;
  const locked = engine.getDesign().locks.components[id]?.locked;
  run(locked ? engine.unlockComponent(id) : engine.lockComponent(id), `${id} ${locked ? 'unlocked' : 'locked'}`);
};
$('undo').onclick = () => run(engine.undo(), 'Undone');
$('redo').onclick = () => run(engine.redo(), 'Redone');

render();
