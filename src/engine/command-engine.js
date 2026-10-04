// Deterministic operation format. A future AI layer produces these operations; applying them
// is plain code. There is deliberately NO language model dependency here.
//
//   { op: 'updateComponent', componentId, changes }
//   { op: 'setResponsiveOverride', componentId, breakpoint, changes }
//   { op: 'applyTheme', theme }
//   { op: 'applyDesign', changes }
//   { op: 'lockComponent' | 'unlockComponent', componentId }
//   { op: 'lockProperty' | 'unlockProperty', componentId, property }
//   { op: 'lockGlobalProperty' | 'unlockGlobalProperty', property }
//   { op: 'undo' | 'redo' }
//   { op: 'snapshot', label? }
import { isPlain } from '../controls/common.js';

const need = (...keys) => keys;
export const OPERATIONS = {
  updateComponent: { required: need('componentId', 'changes'), run: (e, o) => e.updateComponent(o.componentId, o.changes) },
  setResponsiveOverride: { required: need('componentId', 'breakpoint', 'changes'), run: (e, o) => e.setResponsiveOverride(o.componentId, o.breakpoint, o.changes) },
  applyTheme: { required: need('theme'), run: (e, o) => e.applyTheme(o.theme) },
  applyDesign: { required: need('changes'), run: (e, o) => e.applyDesign(o.changes) },
  lockComponent: { required: need('componentId'), run: (e, o) => e.lockComponent(o.componentId) },
  unlockComponent: { required: need('componentId'), run: (e, o) => e.unlockComponent(o.componentId) },
  lockProperty: { required: need('componentId', 'property'), run: (e, o) => e.lockProperty(o.componentId, o.property) },
  unlockProperty: { required: need('componentId', 'property'), run: (e, o) => e.unlockProperty(o.componentId, o.property) },
  lockGlobalProperty: { required: need('property'), run: (e, o) => e.lockGlobalProperty(o.property) },
  unlockGlobalProperty: { required: need('property'), run: (e, o) => e.unlockGlobalProperty(o.property) },
  undo: { required: [], run: (e) => e.undo() },
  redo: { required: [], run: (e) => e.redo() },
  snapshot: { required: [], run: (e, o) => e.snapshot(o.label) }
};

/** Returns null when the operation is well formed, else an error object. */
export function validateOperation(op) {
  if (!isPlain(op) || typeof op.op !== 'string') return { code: 'INVALID_OPERATION', message: 'Operation must be an object with an "op" string' };
  const def = OPERATIONS[op.op];
  if (!def) return { code: 'UNKNOWN_OPERATION', message: `Unknown operation "${op.op}"` };
  const missing = def.required.filter((k) => op[k] === undefined);
  return missing.length ? { code: 'INVALID_OPERATION', message: `Operation "${op.op}" is missing: ${missing.join(', ')}` } : null;
}

export function createCommandEngine(engine, { interpreter = null } = {}) {
  /** Execute operations atomically: if any fails, none are applied. */
  function execute(ops) {
    const list = Array.isArray(ops) ? ops : [ops];
    const bad = list.map(validateOperation).filter(Boolean);
    if (bad.length) return { ok: false, errors: bad, results: [] };
    return engine.transaction((e) => list.map((op) => OPERATIONS[op.op].run(e, op)));
  }

  /**
   * Natural-language entry point. Without an interpreter (the default) text is NOT understood
   * and nothing changes. An interpreter is `(text, context) => operations[]`, supplied later
   * (e.g. an AI layer); its output goes through the same validation and locks as any operation.
   */
  function run(input, context = {}) {
    if (typeof input !== 'string') return execute(input);
    if (!interpreter) {
      return { ok: false, errors: [{ code: 'NO_INTERPRETER', message: 'Natural-language interpretation is not implemented yet; pass operations instead' }], results: [] };
    }
    let ops;
    try { ops = interpreter(input, { design: engine.getDesign(), ...context }); }
    catch (err) { return { ok: false, errors: [{ code: 'INTERPRETER_FAILED', message: String(err?.message || err) }], results: [] }; }
    return execute(ops);
  }

  return { execute, run, validateOperation };
}
