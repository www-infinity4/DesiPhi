// Lock state lives in design.locks so it is serialized, snapshotted and undoable.
//   design.locks.global                : property paths locked for every component and theme tokens
//   design.locks.components[id]        : { locked: boolean, properties: [paths] }
// A lock on "shape" covers "shape.radius", "shape.border.width", ...

export const covers = (lockPath, path) => path === lockPath || path.startsWith(`${lockPath}.`);

function entry(design, id) {
  design.locks.components[id] ??= { locked: false, properties: [] };
  return design.locks.components[id];
}

function prune(design, id) {
  const e = design.locks.components[id];
  if (e && !e.locked && e.properties.length === 0) delete design.locks.components[id];
}

export function lockComponent(design, id) { entry(design, id).locked = true; }
export function unlockComponent(design, id) {
  const e = design.locks.components[id];
  if (!e) return;
  e.locked = false;
  e.properties = [];
  prune(design, id);
}
export function lockProperty(design, id, path) {
  const e = entry(design, id);
  if (!e.properties.includes(path)) e.properties.push(path);
}
export function unlockProperty(design, id, path) {
  const e = design.locks.components[id];
  if (!e) return;
  e.properties = e.properties.filter((p) => p !== path);
  prune(design, id);
}
export function lockGlobalProperty(design, path) {
  if (!design.locks.global.includes(path)) design.locks.global.push(path);
}
export function unlockGlobalProperty(design, path) {
  design.locks.global = design.locks.global.filter((p) => p !== path);
}

export const isComponentLocked = (design, id) => !!design.locks.components[id]?.locked;

/** Returns null if the change is allowed, otherwise a rejection { code, message }. */
export function checkLock(design, componentId, path) {
  const g = design.locks.global.find((l) => covers(l, path));
  if (g) return { code: 'LOCKED_GLOBAL', message: `Property "${path}" is globally locked (lock "${g}")` };
  if (componentId) {
    const e = design.locks.components[componentId];
    if (e?.locked) return { code: 'LOCKED_COMPONENT', message: `Component "${componentId}" is locked` };
    const p = e?.properties.find((l) => covers(l, path));
    if (p) return { code: 'LOCKED_PROPERTY', message: `Property "${path}" of "${componentId}" is locked (lock "${p}")` };
  }
  return null;
}
