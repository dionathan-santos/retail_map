-- Run once against the already-deployed D1 database (schema.sql already has
-- these for fresh installs):
--   wrangler d1 execute retail-map-db --remote --file=migrations/002_custom_icons.sql

CREATE TABLE IF NOT EXISTS custom_icons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  image_data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE category_styles ADD COLUMN icon_id INTEGER REFERENCES custom_icons(id);
