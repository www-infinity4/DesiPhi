// Pure helpers over the serializable design object. No DOM, no side effects on inputs
// unless the function name says "set"/"delete".
import { isPlain } from '../controls/common.js';
import { defaultsFor, deepMerge } from '../components/index.js';

export const clone = (v) => structuredClone(v);

export function getTargetRecord(design, targetPath) {
  const [componentId, ...nested] = targetPath.split('/');
  const component = design.components[componentId];
  if (!component) return null;
  return nested.length ? component.targets?.[targetPath] || null : component;
}

export function parentComponentId(targetPath) {
  return targetPath.split('/')[0];
}

export function getPath(obj, path) {
  let cur = obj;
  for (const seg of path.split('.')) {
    if (!isPlain(cur) || !Object.hasOwn(cur, seg)) return undefined;
    cur = cur[seg];
  }
  return cur;
}

export function setPath(obj, path, value) {
  const segs = path.split('.');
  let cur = obj;
  for (const seg of segs.slice(0, -1)) {
    if (!isPlain(cur[seg])) cur[seg] = {};
    cur = cur[seg];
  }
  cur[segs.at(-1)] = value;
}

/** Delete a path and prune now-empty parents. */
export function deletePath(obj, path) {
  const segs = path.split('.');
  const chain = [obj];
  for (const seg of segs.slice(0, -1)) {
    const next = chain.at(-1)?.[seg];
    if (!isPlain(next)) return;
    chain.push(next);
  }
  delete chain.at(-1)[segs.at(-1)];
  for (let i = chain.length - 1; i > 0; i--) {
    if (Object.keys(chain[i]).length === 0) delete chain[i - 1][segs[i - 1]];
  }
}

/** Style resolved without responsive overrides: type defaults (from tokens) + component style. */
export function resolveBaseStyle(design, componentId) {
  const target = getTargetRecord(design, componentId);
  if (!target) return null;
  const type = target.type || design.components[parentComponentId(componentId)].type;
  return deepMerge(defaultsFor(type, design.tokens), clone(target.style));
}

/**
 * Fully resolved style for a breakpoint. Overrides apply only to their own breakpoint;
 * base values are never modified by them. Pass breakpoint = null for the base style.
 */
export function resolveStyle(design, componentId, breakpoint = null) {
  const base = resolveBaseStyle(design, componentId);
  if (!base || !breakpoint) return base;
  return deepMerge(base, clone(getTargetRecord(design, componentId).responsive[breakpoint] || {}));
}
