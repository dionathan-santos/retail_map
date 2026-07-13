// GET  /api/category-styles -> { [category]: { label, color, shape } } overrides
// POST /api/category-styles -> upsert one category's color/shape override
//
// Lets users customize icon/color per category without touching code
// (src/styles/categories.js DEFAULT_CATEGORIES stays the fallback).

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare("SELECT * FROM category_styles").all();
  const overrides = {};
  for (const row of results) {
    overrides[row.category] = { label: row.label, color: row.color, shape: row.shape };
  }
  return Response.json(overrides);
}

export async function onRequestPost({ request, env }) {
  const { category, label, color, shape } = await request.json();
  if (!category || !color || !shape) {
    return Response.json({ error: "category, color and shape are required" }, { status: 400 });
  }

  await env.DB.prepare(
    `INSERT INTO category_styles (category, label, color, shape)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(category) DO UPDATE SET label = excluded.label, color = excluded.color, shape = excluded.shape`
  )
    .bind(category, label || null, color, shape)
    .run();

  return Response.json({ category, label, color, shape });
}
