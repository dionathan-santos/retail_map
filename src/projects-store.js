// Client-side persistence for saved map projects — localStorage only, no
// backend. Points/icons/shapes already live in D1 via worker/index.js;
// projects are a lighter-weight, per-user "saved view" concept layered on
// top, so they stay client-only rather than adding a D1 table.
const STORAGE_KEY = "retail-map-projects";

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(projects) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function listProjects() {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getProject(id) {
  return readAll().find((p) => p.id === id) || null;
}

export function createProject({ name, client, user, view, layers }) {
  const project = {
    id: crypto.randomUUID(),
    name,
    client,
    user,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    view,
    layers,
    points: [],
  };
  const projects = readAll();
  projects.push(project);
  writeAll(projects);
  return project;
}

export function updateProject(id, patch) {
  const projects = readAll();
  const index = projects.findIndex((p) => p.id === id);
  if (index === -1) return null;

  projects[index] = { ...projects[index], ...patch, updatedAt: Date.now() };
  writeAll(projects);
  return projects[index];
}

export function deleteProject(id) {
  writeAll(readAll().filter((p) => p.id !== id));
}
