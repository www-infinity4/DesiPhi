// Linear undo/redo over full design states (designs are small, serializable JSON).
const clone = (v) => structuredClone(v);

export function createHistory(limit = 100) {
  let past = [];
  let future = [];
  return {
    /** Record the state that is about to be replaced. Clears the redo stack. */
    record(state) {
      past.push(clone(state));
      if (past.length > limit) past.shift();
      future = [];
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    undo(current) {
      if (!past.length) return null;
      future.push(clone(current));
      return past.pop();
    },
    redo(current) {
      if (!future.length) return null;
      past.push(clone(current));
      return future.pop();
    },
    save: () => ({ past: clone(past), future: clone(future) }),
    load(saved) { past = clone(saved.past); future = clone(saved.future); },
    clear() { past = []; future = []; }
  };
}
