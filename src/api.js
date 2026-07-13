// Thin client for the Worker's /api/* routes (worker/index.js), backed by
// D1. Single-point-add and bulk upload both go through the same endpoints,
// so both flows write the same schema.

export async function fetchPoints() {
  const res = await fetch("/api/points");
  if (!res.ok) throw new Error(`fetchPoints failed: ${res.status}`);
  return res.json();
}

export async function createPoint(point) {
  const res = await fetch("/api/points", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(point),
  });
  if (!res.ok) throw new Error(`createPoint failed: ${res.status}`);
  return res.json();
}

export async function createPointsBulk(points) {
  const res = await fetch("/api/points/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points }),
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
