// Tracks which project "environment" is currently active (null = the
// shared, temporary base map). Every module that creates or fetches
// points/shapes reads this to know what to scope to; projects-panel.js is
// the only writer, on open/exit/delete.
let current = null;
const listeners = new Set();

export function getCurrentProject() {
  return current;
}

export function getCurrentProjectId() {
  return current?.id ?? null;
}

export function setCurrentProject(project) {
  current = project;
  for (const listener of listeners) listener(current);
}

export function onProjectChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
