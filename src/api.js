// Thin client for the Worker's /api/* routes (worker/index.js), backed by
// D1. Single-point-add and bulk upload both go through the same endpoints,
// so both flows write the same schema.
//
// Points and shapes are scoped by project: pass a projectId to read/write
// inside that project's environment, or omit it for the shared, temporary
// base map (see current-project.js).

export async function fetchPoints(projectId) {
  const qs = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  const res = await fetch(`/api/points${qs}`);
  if (!res.ok) throw new Error(`fetchPoints failed: ${res.status}`);
  return res.json();
}

export async function createPoint(point, projectId) {
  const res = await fetch("/api/points", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...point, project_id: projectId || null }),
  });
  if (!res.ok) throw new Error(`createPoint failed: ${res.status}`);
  return res.json();
}

export async function createPointsBulk(points, projectId) {
  const res = await fetch("/api/points/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points, project_id: projectId || null }),
  });
  if (!res.ok) throw new Error(`createPointsBulk failed: ${res.status}`);
  return res.json();
}

export async function updatePoint(id, point) {
  const res = await fetch(`/api/points/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(point),
  });
  if (!res.ok) throw new Error(`updatePoint failed: ${res.status}`);
  return res.json();
}

export async function deletePoint(id) {
  const res = await fetch(`/api/points/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`deletePoint failed: ${res.status}`);
  return res.json();
}

export async function fetchCategoryStyles() {
  const res = await fetch("/api/category-styles");
  if (!res.ok) return {};
  return res.json();
}

export async function saveCategoryStyle(category, style) {
  const res = await fetch("/api/category-styles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, ...style }),
  });
  if (!res.ok) throw new Error(`saveCategoryStyle failed: ${res.status}`);
  return res.json();
}

export async function fetchIcons() {
  const res = await fetch("/api/icons");
  if (!res.ok) throw new Error(`fetchIcons failed: ${res.status}`);
  return res.json();
}

export async function createIcon(name, imageData) {
  const res = await fetch("/api/icons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, imageData }),
  });
  if (!res.ok) throw new Error(`createIcon failed: ${res.status}`);
  return res.json();
}

export async function deleteIcon(id) {
  const res = await fetch(`/api/icons/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`deleteIcon failed: ${res.status}`);
  return res.json();
}

export async function fetchShapes(projectId) {
  const qs = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  const res = await fetch(`/api/shapes${qs}`);
  if (!res.ok) throw new Error(`fetchShapes failed: ${res.status}`);
  return res.json();
}

export async function createShape(id, geometry, properties, projectId) {
  const res = await fetch("/api/shapes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, geometry, properties, project_id: projectId || null }),
  });
  if (!res.ok) throw new Error(`createShape failed: ${res.status}`);
  return res.json();
}

export async function updateShape(id, geometry, properties) {
  const res = await fetch(`/api/shapes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ geometry, properties }),
  });
  if (!res.ok) throw new Error(`updateShape failed: ${res.status}`);
  return res.json();
}

export async function deleteShapeApi(id) {
  const res = await fetch(`/api/shapes/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`deleteShapeApi failed: ${res.status}`);
  return res.json();
}

// -- projects --------------------------------------------------------------

export async function fetchProjects() {
  const res = await fetch("/api/projects");
  if (!res.ok) throw new Error(`fetchProjects failed: ${res.status}`);
  return res.json();
}

export async function createProjectApi({ name, client, user }) {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, client, user }),
  });
  if (!res.ok) throw new Error(`createProjectApi failed: ${res.status}`);
  return res.json();
}

export async function deleteProjectApi(id) {
  const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`deleteProjectApi failed: ${res.status}`);
  return res.json();
}
