-- Run once against the already-deployed D1 database (schema.sql already has
-- this for fresh installs):
--   wrangler d1 execute retail-map-db --remote --file=migrations/005_icon_size.sql

ALTER TABLE category_styles ADD COLUMN size REAL NOT NULL DEFAULT 0.6;
ALTER TABLE points ADD COLUMN icon_size REAL;
