// Named snapshots hold a complete design (including locks), enough to restore an approved state.
const clone = (v) => structuredClone(v);

export function createSnapshotStore({ clock = () => new Date().toISOString() } = {}) {
  let snaps = [];
  let counter = 0;
  return {
    create(design, label = '') {
      counter += 1;
      const snap = { id: `snapshot-${counter}`, label, createdAt: clock(), design: clone(design) };
      snaps.push(snap);
      return clone(snap);
    },
    get(id) {
      const s = snaps.find((x) => x.id === id);
      return s ? clone(s) : null;
    },
    list: () => snaps.map(({ id, label, createdAt }) => ({ id, label, createdAt })),
    clear() { snaps = []; counter = 0; },
    toJSON: () => clone({ counter, snapshots: snaps }),
    load(data) { snaps = clone(data.snapshots); counter = data.counter; }
  };
}
