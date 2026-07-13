-- Run once against the already-deployed D1 database (schema.sql already has
-- this for fresh installs):
--   wrangler d1 execute retail-map-db --remote --file=migrations/003_shapes.sql

CREATE TABLE IF NOT EXISTS shapes (
  id TEXT PRIMARY KEY,
  geometry TEXT NOT NULL,
  properties TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
