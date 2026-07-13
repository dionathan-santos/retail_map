-- Run once against the already-deployed D1 database (schema.sql already has
-- this for fresh installs):
--   wrangler d1 execute retail-map-db --remote --file=migrations/004_point_icon_id.sql

ALTER TABLE points ADD COLUMN icon_id INTEGER REFERENCES custom_icons(id);
