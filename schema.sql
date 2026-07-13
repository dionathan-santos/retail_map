-- D1 schema for the Retail Map. Apply with:
--   wrangler d1 execute retail-map-db --file=schema.sql

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
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- User-customized category styles (color/shape, or a custom uploaded icon),
-- overriding the app's built-in defaults (src/styles/categories.js:
-- DEFAULT_CATEGORIES). icon_id set means "use this custom icon instead of
-- the drawn shape/color".
CREATE TABLE IF NOT EXISTS category_styles (
  category TEXT PRIMARY KEY,
  label TEXT,
  color TEXT NOT NULL,
  shape TEXT NOT NULL,
  icon_id INTEGER REFERENCES custom_icons(id)
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
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
