import { createEngine } from '../src/index.js';

export const layout = () => ({
  pageType: 'education',
  components: [
    { id: 'hero', type: 'hero', title: 'Ancient Rome' },
    { id: 'overview', type: 'article', body: 'Rome began as a small town.' },
    { id: 'timeline', type: 'timeline' },
    { id: 'lesson-cards', type: 'card-grid', items: ['a', 'b', 'c'] },
    { id: 'quiz', type: 'quiz' },
    { id: 'sources', type: 'sources' }
  ]
});

export function makeEngine() {
  const engine = createEngine();
  const res = engine.createDesign(layout());
  if (!res.ok) throw new Error('fixture failed');
  return engine;
}
