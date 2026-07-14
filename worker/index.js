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
      await ensureSchema(env);
      return handleApi(request, env, url);
    }

    return env.ASSETS.fetch(request);
  },

  // Cloudflare Cron Trigger (see wrangler.toml [triggers]), runs hourly.
  // Base-map data (project_id IS NULL) is meant to be temporary -- GET
  // /api/points and /api/shapes already stop returning anything older than
  // 24h, this just reclaims the storage.
  async scheduled(event, env) {
    await ensureSchema(env);
    await cleanupExpiredBaseMapData(env);
  },
};

async function handleApi(request, env, url) {
  const { pathname } = url;

  if (pathname === "/api/projects" && request.method === "GET") {
    return listProjects(env);
  }
  if (pathname === "/api/projects" && request.method === "POST") {
    return createProject(request, env);
  }
  const projectIdMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (projectIdMatch && request.method === "DELETE") {
    return deleteProject(projectIdMatch[1], env);
  }
  if (pathname === "/api/points" && request.method === "GET") {
    return listPoints(env, url.searchParams.get("project_id"));
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
    return listShapes(env, url.searchParams.get("project_id"));
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

// -- schema self-migration ------------------------------------------------

// The Git-connected Cloudflare deploy pipeline only runs `npm run build` +
// `wrangler versions upload` -- nothing re-applies schema.sql against the
// remote D1 database. Rather than requiring a manual `wrangler d1 execute
// --remote` step after every schema change, the worker brings the database
// up to date itself on first request per isolate. Idempotent and cheap
// (a couple of no-op statements after the first run), so it's safe to call
// unconditionally.
let schemaEnsured = false;

async function ensureSchema(env) {
  if (schemaEnsured) return;

  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS projects (
         id TEXT PRIMARY KEY,
         name TEXT NOT NULL,
         client TEXT NOT NULL,
         user TEXT NOT NULL,
         created_at TEXT NOT NULL DEFAULT (datetime('now'))
       )`
    ),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT)`),
  ]);

  const pointsMigrated = await addColumnIfMissing(env, "points", "project_id", "TEXT REFERENCES projects(id)");
  const shapesMigrated = await addColumnIfMissing(env, "shapes", "project_id", "TEXT REFERENCES projects(id)");

  if (pointsMigrated || shapesMigrated) {
    // The first time project_id starts existing, every point/shape already
    // in the table is real committed work (the whole app, pre-Projects,
    // *was* the base map) -- not throwaway scratch data. Record "now" as
    // the cutoff so the 24h temporary-cleanup rule below only ever applies
    // to base-map rows created after this feature shipped, never to
    // pre-existing ones.
    await env.DB.prepare(
      `INSERT INTO app_meta (key, value) VALUES ('base_map_temporary_since', datetime('now')) ON CONFLICT(key) DO NOTHING`
    ).run();
  }

  schemaEnsured = true;
}

async function addColumnIfMissing(env, table, column, definition) {
  try {
    await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
    return true; // column didn't exist -- this is a real migration
  } catch (err) {
    if (String(err.message || err).toLowerCase().includes("duplicate column name")) return false;
    throw err;
  }
}

let baseMapTemporarySinceCache;

// Rows with created_at before this cutoff are grandfathered in (see
// ensureSchema above) and never expire. Returns "" -- always false against
// any real timestamp in a `created_at < ?` comparison -- for a database
// that was never migrated (fresh install, no legacy data to protect).
async function getBaseMapTemporarySince(env) {
  if (baseMapTemporarySinceCache !== undefined) return baseMapTemporarySinceCache;
  const row = await env.DB.prepare("SELECT value FROM app_meta WHERE key = 'base_map_temporary_since'").first();
  baseMapTemporarySinceCache = row?.value || "";
  return baseMapTemporarySinceCache;
}

async function cleanupExpiredBaseMapData(env) {
  const cutoff = await getBaseMapTemporarySince(env);
  await env.DB.prepare(
    `DELETE FROM points WHERE project_id IS NULL AND created_at >= ? AND created_at < datetime('now', '-24 hours')`
  )
    .bind(cutoff)
    .run();
  await env.DB.prepare(
    `DELETE FROM shapes WHERE project_id IS NULL AND created_at >= ? AND created_at < datetime('now', '-24 hours')`
  )
    .bind(cutoff)
    .run();
}

// -- projects ---------------------------------------------------------

async function listProjects(env) {
  const { results } = await env.DB.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
  return Response.json(results);
}

async function createProject(request, env) {
  const { name, client, user } = await request.json();
  if (!name || !client || !user) {
    return Response.json({ error: "name, client and user are required" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO projects (id, name, client, user) VALUES (?, ?, ?, ?)")
    .bind(id, name, client, user)
    .run();

  const project = await env.DB.prepare("SELECT * FROM projects WHERE id = ?").bind(id).first();
  return Response.json(project, { status: 201 });
}

async function deleteProject(id, env) {
  // Points/shapes aren't just orphaned -- they only ever make sense scoped
  // to the project they were created in, so deleting a project takes its
  // data with it (D1/SQLite doesn't enforce FK cascade by default).
  await env.DB.batch([
    env.DB.prepare("DELETE FROM points WHERE project_id = ?").bind(id),
    env.DB.prepare("DELETE FROM shapes WHERE project_id = ?").bind(id),
    env.DB.prepare("DELETE FROM projects WHERE id = ?").bind(id),
  ]);
  return Response.json({ deleted: id });
}

// -- points ------------------------------------------------------------

// project_id null/absent = the shared base map, which only shows points
// created in the last 24h (see cleanupExpiredBaseMapData) -- points inside
// a project never expire.
async function listPoints(env, projectId) {
  const base = `SELECT p.*, ci.image_data AS icon_image FROM points p LEFT JOIN custom_icons ci ON ci.id = p.icon_id`;
  let query;
  if (projectId) {
    query = env.DB.prepare(`${base} WHERE p.project_id = ? ORDER BY p.id DESC`).bind(projectId);
  } else {
    const cutoff = await getBaseMapTemporarySince(env);
    query = env.DB.prepare(
      `${base} WHERE p.project_id IS NULL AND (p.created_at < ? OR p.created_at >= datetime('now', '-24 hours')) ORDER BY p.id DESC`
    ).bind(cutoff);
  }

  const { results } = await query.all();
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
  const { points, project_id } = await request.json();
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
  const batch = validated.map((p) => stmt.bind(...pointBindings({ ...p, project_id })));
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
    `INSERT INTO points (name, category, lat, lng, address, status, source, last_updated, icon_color, icon_shape, icon_id, icon_size, project_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    p.project_id || null,
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

// Same base-map-vs-project split (and grandfather cutoff) as listPoints above.
async function listShapes(env, projectId) {
  let query;
  if (projectId) {
    query = env.DB.prepare("SELECT * FROM shapes WHERE project_id = ?").bind(projectId);
  } else {
    const cutoff = await getBaseMapTemporarySince(env);
    query = env.DB.prepare(
      "SELECT * FROM shapes WHERE project_id IS NULL AND (created_at < ? OR created_at >= datetime('now', '-24 hours'))"
    ).bind(cutoff);
  }

  const { results } = await query.all();
  return Response.json(
    results.map((row) => ({
      id: row.id,
      geometry: JSON.parse(row.geometry),
      properties: JSON.parse(row.properties),
    }))
  );
}

async function createShape(request, env) {
  const { id, geometry, properties, project_id } = await request.json();
  if (!id || !geometry) {
    return Response.json({ error: "id and geometry are required" }, { status: 400 });
  }

  await env.DB.prepare("INSERT INTO shapes (id, geometry, properties, project_id) VALUES (?, ?, ?, ?)")
    .bind(id, JSON.stringify(geometry), JSON.stringify(properties || {}), project_id || null)
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
