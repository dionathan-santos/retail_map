// Worker entry point for Cloudflare's unified Workers (with static assets),
// replacing the old Cloudflare Pages + /functions setup (Pages' git-connect
// flow isn't offered by the dashboard anymore -- "Create a Worker" is the
// only option now, so the API routes that used to live in /functions/api/*
// are consolidated here as a single fetch handler).
//
// Static files (the built app in dist/) are served via the `ASSETS`
// binding for any request that isn't under /api/*.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleApi(request, env, url) {
  const { pathname } = url;

  if (pathname === "/api/points" && request.method === "GET") {
    return listPoints(env);
  }
  if (pathname === "/api/points" && request.method === "POST") {
    return createPoint(request, env);
  }
  if (pathname === "/api/points/bulk" && request.method === "POST") {
    return createPointsBulk(request, env);
  }
  const pointIdMatch = pathname.match(/^\/api\/points\/(\d+)$/);
  if (pointIdMatch && request.method === "DELETE") {
    return deletePoint(Number(pointIdMatch[1]), env);
  }
  if (pathname === "/api/category-styles" && request.method === "GET") {
    return listCategoryStyles(env);
  }
  if (pathname === "/api/category-styles" && request.method === "POST") {
    return saveCategoryStyle(request, env);
  }

  return Response.json({ error: "not found" }, { status: 404 });
}

// -- points ------------------------------------------------------------

async function listPoints(env) {
  const { results } = await env.DB.prepare("SELECT * FROM points ORDER BY id DESC").all();
  return Response.json(results);
}

async function createPoint(request, env) {
  const body = await request.json();
  const point = validatePoint(body);
  if (point.error) {
    return Response.json({ error: point.error }, { status: 400 });
  }

  const result = await insertPointStmt(env).bind(...pointBindings(point)).run();
  return Response.json({ id: result.meta.last_row_id, ...point }, { status: 201 });
}

async function createPointsBulk(request, env) {
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

  const stmt = insertPointStmt(env);
  const batch = validated.map((p) => stmt.bind(...pointBindings(p)));
  await env.DB.batch(batch);

  return Response.json({ inserted: validated.length, errors }, { status: 201 });
}

async function deletePoint(id, env) {
  await env.DB.prepare("DELETE FROM points WHERE id = ?").bind(id).run();
  return Response.json({ deleted: id });
}

function insertPointStmt(env) {
  return env.DB.prepare(
    `INSERT INTO points (name, category, lat, lng, address, status, source, last_updated, icon_color, icon_shape)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
}

function pointBindings(p) {
  return [
    p.name,
    p.category,
    p.lat,
    p.lng,
    p.address || null,
    p.status || "active",
    p.source || null,
    p.last_updated || null,
    p.icon_color || null,
    p.icon_shape || null,
  ];
}

function validatePoint(body) {
  const { name, category, lat, lng } = body || {};
  if (!name || typeof name !== "string") return { error: "name is required" };
  if (!category || typeof category !== "string") return { error: "category is required" };
  if (typeof lat !== "number" || typeof lng !== "number") return { error: "lat/lng must be numbers" };
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return { error: "lat/lng out of range" };
  return { ...body };
}

// -- category styles -----------------------------------------------------

async function listCategoryStyles(env) {
  const { results } = await env.DB.prepare("SELECT * FROM category_styles").all();
  const overrides = {};
  for (const row of results) {
    overrides[row.category] = { label: row.label, color: row.color, shape: row.shape };
  }
  return Response.json(overrides);
}

async function saveCategoryStyle(request, env) {
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
