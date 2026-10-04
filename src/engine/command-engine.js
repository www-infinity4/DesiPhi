import { isPlain } from '../controls/common.js';
import { resolveSelector } from './selectors.js';
import { resolveVisualPreset } from '../themes/visual-presets.js';

const need = (...keys) => keys;
export const OPERATIONS = {
  updateComponent: { required: need('componentId', 'changes') },
  setResponsiveOverride: { required: need('componentId', 'breakpoint', 'changes') },
  applyTheme: { required: need('theme') },
  applyDesign: { required: need('changes') },
  lockComponent: { required: need('componentId') },
  unlockComponent: { required: need('componentId') },
  lockProperty: { required: need('componentId', 'property') },
  unlockProperty: { required: need('componentId', 'property') },
  lockGlobalProperty: { required: need('property') },
  unlockGlobalProperty: { required: need('property') },
  undo: { required: [] },
  redo: { required: [] },
  snapshot: { required: [] },
  SET: { required: need('selector', 'path', 'value') },
  ADJUST: { required: need('selector', 'path', 'delta') },
  RESET: { required: need('selector', 'path') },
  APPLY_THEME: { required: need('theme') },
  APPLY_PRESET: { required: need('selector', 'preset') },
  LOCK: { required: need('selector') },
  UNLOCK: { required: need('selector') },
  HIDE_DECORATION: { required: need('selector') },
  SHOW_DECORATION: { required: need('selector') },
  RESPONSIVE_SET: { required: need('selector', 'breakpoint', 'path', 'value') },
  COPY_STYLE: { required: need('source', 'destination') },
  RESET_COMPONENT: { required: need('selector') },
  RESET_PROPERTY: { required: need('selector', 'path') }
};

export function validateOperation(op) {
  if (!isPlain(op) || typeof op.op !== 'string') return {
    code: 'INVALID_OPERATION', message: 'Operation must be an object with an "op" string'
  };
  const def = OPERATIONS[op.op];
  if (!def) return { code: 'UNKNOWN_OPERATION', message: `Unknown operation "${op.op}"` };
  const missing = def.required.filter((key) => op[key] === undefined);
  return missing.length ? {
    code: 'INVALID_OPERATION', message: `Operation "${op.op}" is missing: ${missing.join(', ')}`
  } : null;
}

function pathChanges(path, value) {
  const parts = path.split('.');
  return parts.reduceRight((child, key, index) => ({ [key]: index === parts.length - 1 ? value : child }), {});
}

function selectedTargets(engine, selector) {
  const result = resolveSelector(engine.getDesign(), selector);
  return result.ok ? result.targets : result;
}

function applySelected(engine, selector, callback) {
  const selected = selectedTargets(engine, selector);
  if (!Array.isArray(selected)) return selected;
  const results = selected.map((target) => callback(target));
  const errors = results.flatMap((result) => result.errors || []);
  return { ok: errors.length === 0 && results.every((result) => result.ok), results, errors };
}

function applyOperation(engine, operation) {
  const { op } = operation;
  if (['updateComponent', 'setResponsiveOverride', 'applyTheme', 'applyDesign',
    'lockComponent', 'unlockComponent', 'lockProperty', 'unlockProperty',
    'lockGlobalProperty', 'unlockGlobalProperty', 'undo', 'redo', 'snapshot'].includes(op)) {
    const actions = {
      updateComponent: () => engine.updateComponent(operation.componentId, operation.changes),
      setResponsiveOverride: () => engine.setResponsiveOverride(operation.componentId, operation.breakpoint, operation.changes),
      applyTheme: () => engine.applyTheme(operation.theme),
      applyDesign: () => engine.applyDesign(operation.changes),
      lockComponent: () => engine.lockComponent(operation.componentId),
      unlockComponent: () => engine.unlockComponent(operation.componentId),
      lockProperty: () => engine.lockProperty(operation.componentId, operation.property),
      unlockProperty: () => engine.unlockProperty(operation.componentId, operation.property),
      lockGlobalProperty: () => engine.lockGlobalProperty(operation.property),
      unlockGlobalProperty: () => engine.unlockGlobalProperty(operation.property),
      undo: () => engine.undo(),
      redo: () => engine.redo(),
      snapshot: () => engine.snapshot(operation.label)
    };
    return actions[op]();
  }

  if (op === 'APPLY_THEME') return engine.applyTheme(operation.theme);
  if (op === 'COPY_STYLE') {
    const source = selectedTargets(engine, operation.source);
    if (!Array.isArray(source)) return source;
    if (source.length !== 1) return { ok: false, errors: [{ code: 'AMBIGUOUS_SELECTOR', message: 'COPY_STYLE source must match exactly one target' }] };
    return applySelected(engine, operation.destination, (target) => engine.copyStyle(source[0].path, target.path));
  }

  return applySelected(engine, operation.selector, (target) => {
    switch (op) {
      case 'SET':
        return engine.updateComponent(target.path, pathChanges(operation.path, operation.value));
      case 'ADJUST':
        return engine.adjustProperty(target.path, operation.path, operation.delta);
      case 'RESET':
      case 'RESET_PROPERTY':
        return engine.resetProperty(target.path, operation.path, operation.breakpoint || null);
      case 'RESPONSIVE_SET':
        return engine.setResponsiveOverride(target.path, operation.breakpoint, pathChanges(operation.path, operation.value));
      case 'RESET_COMPONENT':
        return engine.resetComponent(target.path);
      case 'LOCK':
        return operation.path ? engine.lockProperty(target.path, operation.path) : engine.lockComponent(target.path);
      case 'UNLOCK':
        return operation.path ? engine.unlockProperty(target.path, operation.path) : engine.unlockComponent(target.path);
      case 'HIDE_DECORATION':
        return engine.updateComponent(target.path, { effects: { decorationVisible: false } });
      case 'SHOW_DECORATION':
        return engine.updateComponent(target.path, { effects: { decorationVisible: true } });
      case 'APPLY_PRESET': {
        const preset = resolveVisualPreset(target.type, operation.preset);
        return preset.ok ? engine.updateComponent(target.path, preset.changes) : preset;
      }
      default:
        return { ok: false, errors: [{ code: 'UNKNOWN_OPERATION', message: `Unknown operation "${op}"` }] };
    }
  });
}

/** Provider output is data only: the interpreter cannot write to or mutate the design. */
export function interpretDesignCommand(text, context = {}, provider = null) {
  if (typeof text !== 'string') return { ok: false, errors: [{ code: 'INVALID_COMMAND', message: 'Command text must be a string' }] };
  if (typeof provider !== 'function') return { ok: false, errors: [{ code: 'NO_INTERPRETER', message: 'No interpretation provider is configured' }] };
  try {
    const output = provider(text, structuredClone(context));
    const operations = Array.isArray(output) ? output : output?.operations;
    if (!Array.isArray(operations)) return { ok: false, errors: [{ code: 'INVALID_INTERPRETER_OUTPUT', message: 'Interpreter must return normalized operations' }] };
    const errors = operations.map(validateOperation).filter(Boolean);
    return errors.length ? { ok: false, errors } : { ok: true, operations: structuredClone(operations) };
  } catch (error) {
    return { ok: false, errors: [{ code: 'INTERPRETER_FAILED', message: String(error?.message || error) }] };
  }
}

export const createDesignInterpreter = (provider) => (text, context) => {
  const result = interpretDesignCommand(text, context, provider);
  if (!result.ok) throw new Error(result.errors.map((error) => error.message).join('; '));
  return result.operations;
};

export function createCommandEngine(engine, { interpreter = null } = {}) {
  function execute(ops) {
    const list = Array.isArray(ops) ? ops : [ops];
    const bad = list.map(validateOperation).filter(Boolean);
    if (bad.length) return { ok: false, errors: bad, results: [] };
    return engine.transaction((e) => list.map((operation) => applyOperation(e, operation)));
  }

  function run(input, context = {}) {
    if (typeof input !== 'string') return execute(input);
    const parsed = interpretDesignCommand(input, { design: engine.getDesign(), ...context }, interpreter);
    return parsed.ok ? execute(parsed.operations) : { ...parsed, results: [] };
  }

  return { execute, run, validateOperation };
}
