-- Run this once in the D1 database's dashboard Console tab (or via
-- `wrangler d1 execute retail-map-db --file=schema.sql`) after creating the
-- database. See README.md "Persisting drawn shapes (Cloudflare D1)".

CREATE TABLE IF NOT EXISTS drawn_features (
  id TEXT PRIMARY KEY,
  layer_key TEXT NOT NULL,
  geometry TEXT NOT NULL,
  properties TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_drawn_features_layer_key ON drawn_features (layer_key);
