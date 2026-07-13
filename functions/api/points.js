// GET  /api/points        -> list all points
// POST /api/points        -> create a single point (click-to-place or manual form)
//
// Both this endpoint and points/bulk.js write to the same `points` table
// with the same schema, so single-add and bulk-upload stay consistent.

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare("SELECT * FROM points ORDER BY id DESC").all();
  return Response.json(results);
}

export async function onRequestPost({ request, env }) {
  const body = await request.json();
  const point = validatePoint(body);
  if (point.error) {
    return Response.json({ error: point.error }, { status: 400 });
  }

  const result = await env.DB.prepare(
    `INSERT INTO points (name, category, lat, lng, address, status, source, last_updated, icon_color, icon_shape)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      point.name,
      point.category,
      point.lat,
      point.lng,
      point.address || null,
      point.status || "active",
      point.source || null,
      point.last_updated || null,
      point.icon_color || null,
      point.icon_shape || null
    )
    .run();

  return Response.json({ id: result.meta.last_row_id, ...point }, { status: 201 });
}

export function validatePoint(body) {
  const { name, category, lat, lng } = body || {};
  if (!name || typeof name !== "string") return { error: "name is required" };
  if (!category || typeof category !== "string") return { error: "category is required" };
  if (typeof lat !== "number" || typeof lng !== "number") return { error: "lat/lng must be numbers" };
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return { error: "lat/lng out of range" };
  return { ...body };
}
