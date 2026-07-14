-- D1 schema for the Retail Map. Apply with:
--   wrangler d1 execute retail-map-db --file=schema.sql
--
-- Note: for the already-deployed production database, worker/index.js also
-- self-migrates (ensureSchema()) the `projects` table and the `project_id`
-- columns below on first request, since this repo's deploy pipeline has no
-- step that re-runs schema.sql against the remote D1 database. This file
-- stays the source of truth for a from-scratch `wrangler d1 execute` setup.

-- A "project" is an isolated workspace: while active, points/shapes created
-- via the normal map tools are tagged with its id instead of being added to
-- the shared base map. See project_id on points/shapes below.
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  client TEXT NOT NULL,
  user TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  address TEXT,
  status TEXT DEFAULT 'active',
  source TEXT,
  last_updated TEXT,
  icon_color TEXT,   -- optional per-point override of the category color
  icon_shape TEXT,   -- optional per-point override of the category shape
  icon_id INTEGER REFERENCES custom_icons(id), -- optional per-point custom icon (overrides the category's icon)
  icon_size REAL,    -- optional per-point override of the category's icon size
  -- NULL = this point lives on the shared base map, not inside a project.
  -- Base-map points are temporary: the worker's scheduled cleanup deletes
  -- any with project_id IS NULL older than 24h, and GET /api/points already
  -- excludes them from that point on regardless of whether the cron has run
  -- yet.
  project_id TEXT REFERENCES projects(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_points_project ON points(project_id);

-- User-customized category styles (color/shape, or a custom uploaded icon),
-- overriding the app's built-in defaults (src/styles/categories.js:
-- DEFAULT_CATEGORIES). icon_id set means "use this custom icon instead of
-- the drawn shape/color".
CREATE TABLE IF NOT EXISTS category_styles (
  category TEXT PRIMARY KEY,
  label TEXT,
  color TEXT NOT NULL,
  shape TEXT NOT NULL,
  icon_id INTEGER REFERENCES custom_icons(id),
  size REAL NOT NULL DEFAULT 0.6 -- MapLibre icon-size multiplier
);

-- User-uploaded icon images (small PNGs), stored inline as base64 -- no R2
-- bucket needed for this. Assigned to categories via category_styles.icon_id.
CREATE TABLE IF NOT EXISTS custom_icons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  image_data TEXT NOT NULL, -- base64-encoded PNG, no "data:image/png;base64," prefix
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- User-drawn/editable polygons (src/draw.js, Terra Draw). geometry and
-- properties are stored as JSON strings; id matches Terra Draw's own
-- feature id (a UUID) so create/update/delete map 1:1 with its store.
CREATE TABLE IF NOT EXISTS shapes (
  id TEXT PRIMARY KEY,
  geometry TEXT NOT NULL,
  properties TEXT NOT NULL,
  -- Same base-map-vs-project split and 24h temporary-cleanup rule as
  -- points.project_id above.
  project_id TEXT REFERENCES projects(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_shapes_project ON shapes(project_id);

-- Tiny key/value table for app-level bookkeeping. Currently holds one key,
-- base_map_temporary_since, written once by ensureSchema() the first time
-- it migrates an existing points/shapes table to add project_id -- it marks
-- the cutoff after which base-map rows are actually subject to the 24h
-- cleanup, so pre-existing (pre-Projects-feature) data is grandfathered in
-- and never auto-deleted. Absent/empty on a from-scratch install, where
-- there's no legacy data to protect and the 24h rule applies from row 1.
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
