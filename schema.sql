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
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- User-customized category styles (color/shape), overriding the app's
-- built-in defaults (src/styles/categories.js: DEFAULT_CATEGORIES).
CREATE TABLE IF NOT EXISTS category_styles (
  category TEXT PRIMARY KEY,
  label TEXT,
  color TEXT NOT NULL,
  shape TEXT NOT NULL
);
