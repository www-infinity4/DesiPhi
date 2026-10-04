// Framework- and DOM-independent design engine. The design object is the source of truth.
// Every mutating method is atomic: it either fully applies (and is recorded in history) or is
// rejected with a list of errors, leaving the design untouched. Methods do not throw on
// invalid operations; they return { ok:false, errors:[...] }.
import { emptyDesign, SCHEMA_ID, SCHEMA_VERSION, STRUCTURAL_KEYS } from '../schema/design-schema.js';
import { createComponentRecord } from '../schema/component-schema.js';
import { ingestLayout, verifyPreserved } from '../adapters/layaphi-adapter.js';
import { PRESETS } from '../themes/presets.js';
import { resolveTheme } from '../themes/theme-engine.js';
import { flattenChanges, validateChange, isKnownPath } from '../controls/index.js';
import { isBreakpoint } from '../controls/responsive.js';
import { isPlain } from '../controls/common.js';
import { createHistory } from '../history/undo.js';
import { createSnapshotStore } from '../history/snapshots.js';
import * as locks from '../locks/design-lock.js';
import { validateDesign } from './design-validator.js';
import { clone, getPath, setPath, deletePath, resolveBaseStyle, resolveStyle } from './design-state.js';

const fail = (...errors) => ({ ok: false, errors });

export class DesignEngine {
  constructor({ themes = PRESETS, historyLimit = 100, clock } = {}) {
    this.themes = themes;
    this.history = createHistory(historyLimit);
    this.snapshots = createSnapshotStore(clock ? { clock } : {});
    this.design = null;
    this.layout = null;
  }

  // ---- creation / import / export ----

  createDesign(layoutSpec, { theme = 'educational' } = {}) {
    const ing = ingestLayout(layoutSpec);
    if (!ing.ok) return ing;
    const t = resolveTheme(theme, this.themes);
    if (!t.ok) return t;
    const d = emptyDesign();
    d.theme = t.theme.name;
    d.pageType = ing.layout.pageType;
    d.tokens = t.theme.tokens;
    for (const entry of ing.layout.components) {
      d.components[entry.id] = createComponentRecord(entry);
      d.order.push(entry.id);
      d.source.components.push({ id: entry.id, type: entry.type });
    }
    this.layout = ing.layout;
    this.design = d;
    this.history.clear();
    this.snapshots.clear();
    return { ok: true, design: clone(d) };
  }

  /** Serializable copy of the design (JSON.stringify-safe). */
  exportDesign() { return this.design ? clone(this.design) : null; }

  /** Load a previously exported design (object or JSON string). Invalid input is rejected. */
  importDesign(input) {
    let d = input;
    if (typeof input === 'string') {
      try { d = JSON.parse(input); } catch { return fail({ code: 'INVALID_DESIGN', message: 'Not valid JSON' }); }
    }
    const report = validateDesign(d);
    if (!report.ok) return { ok: false, errors: report.errors };
    this.design = clone(d);
    this.layout = null;
    this.history.clear();
    this.snapshots.clear();
    return { ok: true, design: clone(this.design) };
  }

  getDesign() { return this.design ? clone(this.design) : null; }
  getComponent(id) { const c = this.design?.components[id]; return c ? clone(c) : null; }
  resolveStyle(id, breakpoint = null) { return this.design ? resolveStyle(this.design, id, breakpoint) : null; }

  // ---- transactional core ----

  _commit(mutate) {
    if (!this.design) return fail({ code: 'NO_DESIGN', message: 'Call createDesign() first' });
    const next = clone(this.design);
    const errors = [];
    mutate(next, errors);
    if (errors.length) return { ok: false, errors };
    const report = validateDesign(next);
    if (!report.ok) return { ok: false, errors: report.errors };
    if (this.layout) {
      const kept = verifyPreserved(this.layout, next);
      if (!kept.ok) return { ok: false, errors: kept.errors };
    }
    this.history.record(this.design);
    this.design = next;
    return { ok: true, design: clone(next), warnings: report.warnings };
  }

  /** Validate + stage style changes onto `target` (a style object). Locks are checked per leaf. */
  _stageStyle(design, componentId, target, changes, errors) {
    if (!isPlain(changes)) { errors.push({ code: 'INVALID_VALUE', message: 'changes must be an object', componentId }); return; }
    for (const [path, value] of flattenChanges(changes)) {
      const bad = validateChange(path, value) || locks.checkLock(design, componentId, path);
      if (bad) { errors.push({ ...bad, componentId, path }); continue; }
      if (value === null) deletePath(target, path); else setPath(target, path, clone(value));
    }
  }

  _component(design, id, errors) {
    const c = design.components[id];
    if (!c) errors.push({ code: 'UNKNOWN_COMPONENT', message: `Unknown component "${id}"`, componentId: id });
    return c;
  }

  // ---- design operations ----

  updateComponent(componentId, changes) {
    return this._commit((d, errors) => {
      const c = this._component(d, componentId, errors);
      if (!c) return;
      for (const key of Object.keys(isPlain(changes) ? changes : {})) {
        if (STRUCTURAL_KEYS.includes(key)) {
          errors.push({ code: 'STRUCTURAL_PROTECTED', message: `"${key}" belongs to LayaPhi and cannot be changed by DesiPhi`, componentId, path: key });
        }
      }
      if (errors.length) return;
      this._stageStyle(d, componentId, c.style, changes, errors);
    });
  }

  setResponsiveOverride(componentId, breakpoint, changes) {
    return this._commit((d, errors) => {
      const c = this._component(d, componentId, errors);
      if (!c) return;
      if (!isBreakpoint(breakpoint)) {
        errors.push({ code: 'INVALID_BREAKPOINT', message: `Unknown breakpoint "${breakpoint}"`, componentId });
        return;
      }
      this._stageStyle(d, componentId, c.responsive[breakpoint], changes, errors);
    });
  }

  /**
   * Bulk update. changes = { theme?, components?: { id: styleChanges },
   * responsive?: { id: { breakpoint: styleChanges } } }. All-or-nothing.
   */
  applyDesign(changes) {
    if (!isPlain(changes)) return fail({ code: 'INVALID_VALUE', message: 'changes must be an object' });
    const unknown = Object.keys(changes).filter((k) => !['theme', 'components', 'responsive'].includes(k));
    if (unknown.length) return fail(...unknown.map((k) => ({ code: 'UNKNOWN_PROPERTY', message: `Unknown change key "${k}"` })));
    return this._commit((d, errors) => {
      if (changes.theme !== undefined) this._stageTheme(d, changes.theme, errors);
      for (const [id, ch] of Object.entries(changes.components || {})) {
        const c = this._component(d, id, errors);
        if (c) this._stageStyle(d, id, c.style, ch, errors);
      }
      for (const [id, byBp] of Object.entries(changes.responsive || {})) {
        const c = this._component(d, id, errors);
        if (!c) continue;
        for (const [bp, ch] of Object.entries(byBp)) {
          if (!isBreakpoint(bp)) errors.push({ code: 'INVALID_BREAKPOINT', message: `Unknown breakpoint "${bp}"`, componentId: id });
          else this._stageStyle(d, id, c.responsive[bp], ch, errors);
        }
      }
    });
  }

  applyTheme(theme) {
    return this._commit((d, errors) => this._stageTheme(d, theme, errors));
  }

  _stageTheme(d, theme, errors) {
    const t = resolveTheme(theme, this.themes);
    if (!t.ok) { errors.push(...t.errors); return; }
    const before = clone(d);
    // Globally locked token properties may not change.
    const old = flattenChanges(before.tokens);
    const oldMap = new Map(old);
    for (const [path, value] of flattenChanges(t.theme.tokens)) {
      if (JSON.stringify(oldMap.get(path)) === JSON.stringify(value)) continue;
      const lock = d.locks.global.find((l) => path === l || path.startsWith(`${l}.`));
      if (lock) errors.push({ code: 'LOCKED_GLOBAL', message: `Theme would change globally locked property "${path}"`, path });
    }
    if (errors.length) return;
    d.theme = t.theme.name;
    d.tokens = t.theme.tokens;
    // Locked components/properties keep their current look: pin the previous resolved values.
    for (const [id, lock] of Object.entries(d.locks.components)) {
      const resolved = resolveBaseStyle(before, id);
      if (lock.locked) d.components[id].style = resolved;
      else for (const p of lock.properties) {
        const v = getPath(resolved, p);
        if (v !== undefined) setPath(d.components[id].style, p, clone(v));
      }
    }
  }

  // ---- locks ----

  lockComponent(id) { return this._lockOp(id, null, (d) => locks.lockComponent(d, id)); }
  unlockComponent(id) { return this._lockOp(id, null, (d) => locks.unlockComponent(d, id)); }
  lockProperty(id, property) { return this._lockOp(id, property, (d) => locks.lockProperty(d, id, property)); }
  unlockProperty(id, property) { return this._lockOp(id, property, (d) => locks.unlockProperty(d, id, property)); }
  lockGlobalProperty(property) { return this._lockOp(null, property, (d) => locks.lockGlobalProperty(d, property)); }
  unlockGlobalProperty(property) { return this._lockOp(null, property, (d) => locks.unlockGlobalProperty(d, property)); }

  _lockOp(id, property, apply) {
    return this._commit((d, errors) => {
      if (id !== null) this._component(d, id, errors);
      if (property !== null && !isKnownPath(property)) {
        errors.push({ code: 'UNKNOWN_PROPERTY', message: `Unknown design property "${property}"`, path: property });
      }
      if (!errors.length) apply(d);
    });
  }

  // ---- history ----

  undo() {
    if (!this.design) return fail({ code: 'NO_DESIGN', message: 'Call createDesign() first' });
    const prev = this.history.undo(this.design);
    if (!prev) return fail({ code: 'NOTHING_TO_UNDO', message: 'Nothing to undo' });
    this.design = prev;
    return { ok: true, design: clone(prev) };
  }

  redo() {
    if (!this.design) return fail({ code: 'NO_DESIGN', message: 'Call createDesign() first' });
    const next = this.history.redo(this.design);
    if (!next) return fail({ code: 'NOTHING_TO_REDO', message: 'Nothing to redo' });
    this.design = next;
    return { ok: true, design: clone(next) };
  }

  canUndo() { return this.history.canUndo(); }
  canRedo() { return this.history.canRedo(); }

  /** Capture the full current design (including locks) under an optional label. */
  snapshot(label = '') {
    if (!this.design) return fail({ code: 'NO_DESIGN', message: 'Call createDesign() first' });
    return { ok: true, snapshot: this.snapshots.create(this.design, label) };
  }

  listSnapshots() { return this.snapshots.list(); }

  /** Restore a snapshot. The restore itself is undoable. */
  restoreSnapshot(id) {
    const snap = this.snapshots.get(id);
    if (!snap) return fail({ code: 'UNKNOWN_SNAPSHOT', message: `Unknown snapshot "${id}"` });
    return this._commit((d) => { Object.keys(d).forEach((k) => delete d[k]); Object.assign(d, snap.design); });
  }

  /**
   * Run several operations atomically. fn receives the engine and returns an array of results;
   * if any is not ok, design and history are rolled back to their state before the call.
   */
  transaction(fn) {
    const design = this.design ? clone(this.design) : null;
    const saved = this.history.save();
    let results;
    try {
      results = fn(this);
    } catch (err) {
      this.design = design;
      this.history.load(saved);
      return { ok: false, results: [], errors: [{ code: 'TRANSACTION_FAILED', message: String(err?.message || err) }] };
    }
    if (results.every((r) => r.ok)) return { ok: true, results };
    this.design = design;
    this.history.load(saved);
    return { ok: false, results, errors: results.flatMap((r) => r.errors || []) };
  }

  validateDesign() {
    if (!this.design) return { ok: false, errors: [{ code: 'NO_DESIGN', message: 'Call createDesign() first' }], warnings: [] };
    return validateDesign(this.design);
  }
}

export const createEngine = (options) => new DesignEngine(options);
export { SCHEMA_ID, SCHEMA_VERSION };
