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
  if (pointIdMatch && request.method === "PUT") {
    return updatePoint(Number(pointIdMatch[1]), request, env);
  }
  if (pathname === "/api/category-styles" && request.method === "GET") {
    return listCategoryStyles(env);
  }
  if (pathname === "/api/category-styles" && request.method === "POST") {
    return saveCategoryStyle(request, env);
  }
  if (pathname === "/api/icons" && request.method === "GET") {
    return listIcons(env);
  }
  if (pathname === "/api/icons" && request.method === "POST") {
    return createIcon(request, env);
  }
  const iconIdMatch = pathname.match(/^\/api\/icons\/(\d+)$/);
  if (iconIdMatch && request.method === "DELETE") {
    return deleteIcon(Number(iconIdMatch[1]), env);
  }
  if (pathname === "/api/shapes" && request.method === "GET") {
    return listShapes(env);
  }
  if (pathname === "/api/shapes" && request.method === "POST") {
    return createShape(request, env);
  }
  const shapeIdMatch = pathname.match(/^\/api\/shapes\/([^/]+)$/);
  if (shapeIdMatch && request.method === "PUT") {
    return updateShape(shapeIdMatch[1], request, env);
  }
  if (shapeIdMatch && request.method === "DELETE") {
    return deleteShape(shapeIdMatch[1], env);
  }

  return Response.json({ error: "not found" }, { status: 404 });
}

// -- points ------------------------------------------------------------

async function listPoints(env) {
  const { results } = await env.DB.prepare(
    `SELECT p.*, ci.image_data AS icon_image
     FROM points p
     LEFT JOIN custom_icons ci ON ci.id = p.icon_id
     ORDER BY p.id DESC`
  ).all();
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

async function updatePoint(id, request, env) {
  const body = await request.json();
  const point = validatePoint(body);
  if (point.error) {
    return Response.json({ error: point.error }, { status: 400 });
  }

  await env.DB.prepare(
    `UPDATE points SET name = ?, category = ?, lat = ?, lng = ?, address = ?, status = ?, source = ?,
       last_updated = ?, icon_color = ?, icon_shape = ?, icon_id = ?, icon_size = ? WHERE id = ?`
  )
    .bind(...pointBindings(point), id)
    .run();

  return Response.json({ id, ...point });
}

function insertPointStmt(env) {
  return env.DB.prepare(
    `INSERT INTO points (name, category, lat, lng, address, status, source, last_updated, icon_color, icon_shape, icon_id, icon_size)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    p.iconId || null,
    p.iconSize || null,
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
  const { results } = await env.DB.prepare(
    `SELECT cs.category, cs.label, cs.color, cs.shape, cs.icon_id, cs.size, ci.image_data AS icon_image
     FROM category_styles cs
     LEFT JOIN custom_icons ci ON ci.id = cs.icon_id`
  ).all();

  const overrides = {};
  for (const row of results) {
    overrides[row.category] = {
      label: row.label,
      color: row.color,
      shape: row.shape,
      iconId: row.icon_id || null,
      iconImage: row.icon_image || null,
      size: row.size,
    };
  }
  return Response.json(overrides);
}

async function saveCategoryStyle(request, env) {
  const { category, label, color, shape, iconId, size } = await request.json();
  if (!category || !color || !shape) {
    return Response.json({ error: "category, color and shape are required" }, { status: 400 });
  }

  await env.DB.prepare(
    `INSERT INTO category_styles (category, label, color, shape, icon_id, size)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(category) DO UPDATE SET label = excluded.label, color = excluded.color,
       shape = excluded.shape, icon_id = excluded.icon_id, size = excluded.size`
  )
    .bind(category, label || null, color, shape, iconId || null, size ?? 0.6)
    .run();

  return Response.json({ category, label, color, shape, iconId: iconId || null, size: size ?? 0.6 });
}

// -- custom icon bank ------------------------------------------------------

async function listIcons(env) {
  const { results } = await env.DB.prepare(
    "SELECT id, name, image_data FROM custom_icons ORDER BY created_at DESC"
  ).all();
  return Response.json(results);
}

async function createIcon(request, env) {
  const { name, imageData } = await request.json();
  if (!name || !imageData) {
    return Response.json({ error: "name and imageData are required" }, { status: 400 });
  }
  // Base64 PNGs comfortably under D1's ~1MB row/column ceiling; reject
  // anything larger up front rather than letting the insert fail obscurely.
  if (imageData.length > 1_500_000) {
    return Response.json({ error: "icon image is too large (max ~1MB)" }, { status: 400 });
  }

  const result = await env.DB.prepare("INSERT INTO custom_icons (name, image_data) VALUES (?, ?)")
    .bind(name, imageData)
    .run();

  return Response.json({ id: result.meta.last_row_id, name, imageData }, { status: 201 });
}

async function deleteIcon(id, env) {
  await env.DB.prepare("UPDATE category_styles SET icon_id = NULL WHERE icon_id = ?").bind(id).run();
  await env.DB.prepare("DELETE FROM custom_icons WHERE id = ?").bind(id).run();
  return Response.json({ deleted: id });
}

// -- drawn shapes (polygons) -----------------------------------------------

async function listShapes(env) {
  const { results } = await env.DB.prepare("SELECT * FROM shapes").all();
  return Response.json(
    results.map((row) => ({
      id: row.id,
      geometry: JSON.parse(row.geometry),
      properties: JSON.parse(row.properties),
    }))
  );
}

async function createShape(request, env) {
  const { id, geometry, properties } = await request.json();
  if (!id || !geometry) {
    return Response.json({ error: "id and geometry are required" }, { status: 400 });
  }

  await env.DB.prepare("INSERT INTO shapes (id, geometry, properties) VALUES (?, ?, ?)")
    .bind(id, JSON.stringify(geometry), JSON.stringify(properties || {}))
    .run();

  return Response.json({ id, geometry, properties: properties || {} }, { status: 201 });
}

async function updateShape(id, request, env) {
  const { geometry, properties } = await request.json();
  if (!geometry) {
    return Response.json({ error: "geometry is required" }, { status: 400 });
  }

  await env.DB.prepare(
    "UPDATE shapes SET geometry = ?, properties = ?, updated_at = datetime('now') WHERE id = ?"
  )
    .bind(JSON.stringify(geometry), JSON.stringify(properties || {}), id)
    .run();

  return Response.json({ id, geometry, properties: properties || {} });
}

async function deleteShape(id, env) {
  await env.DB.prepare("DELETE FROM shapes WHERE id = ?").bind(id).run();
  return Response.json({ deleted: id });
}
