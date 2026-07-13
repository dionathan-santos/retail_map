// POST /api/points/bulk -> bulk-insert points parsed client-side from an
// uploaded Excel file (name, category, lat, lng, address, status, source,
// last_updated columns -- the existing CM Land Tracker convention).
//
// Writes to the same `points` table as points.js's single-add path.

import { validatePoint } from "../points.js";

export async function onRequestPost({ request, env }) {
  const { points } = await request.json();
  if (!Array.isArray(points) || points.length === 0) {
    return Response.json({ error: "points must be a non-empty array" }, { status: 400 });
  }

  const validated = [];
  const errors = [];
  points.forEach((p, i) => {
    const result = validatePoint(p);
    if (result.error) {
      errors.push({ row: i, error: result.error });
    } else {
      validated.push(result);
    }
  });

  if (validated.length === 0) {
    return Response.json({ error: "no valid rows", errors }, { status: 400 });
  }

  const stmt = env.DB.prepare(
    `INSERT INTO points (name, category, lat, lng, address, status, source, last_updated, icon_color, icon_shape)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const batch = validated.map((p) =>
    stmt.bind(
      p.name,
      p.category,
      p.lat,
      p.lng,
      p.address || null,
      p.status || "active",
      p.source || null,
      p.last_updated || null,
      p.icon_color || null,
      p.icon_shape || null
    )
  );
  await env.DB.batch(batch);

  return Response.json({ inserted: validated.length, errors }, { status: 201 });
}
