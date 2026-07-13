# Edmonton Retail Market Intelligence Map

A web app for plotting your own retail points on top of an existing base
map (an Avison Young-style vector map, rendered from PDF), individually or
in bulk. `RETAIL_MAP_SPEC.md` is the original v1 spec; the v2 pivot
(current architecture) replaced the Protomaps/GIS-pipeline approach
described there with a static georeferenced base map + user-added points.

## Stack

- **Map renderer:** MapLibre GL JS
- **Basemap:** the Avison Young base map (`assets/source/Retail map_no
  icons.pdf`), rendered once to a high-res PNG and georeferenced with the
  existing affine transform, then loaded as a MapLibre raster/image source.
- **Hosting:** Cloudflare Workers (with static assets) — the dashboard's
  "Create a Worker" + Git integration flow, which is what Cloudflare's
  unified Workers & Pages UI offers now (classic standalone Pages projects
  aren't offered as a separate creation flow anymore).
- **Data:** Cloudflare D1 (SQL), accessed through the Worker's own fetch
  handler (`worker/index.js`) — single-point-add and bulk-upload both
  write to the same `points` table.
- **Print export:** client-side canvas capture + jsPDF (no server rendering)

## Local development

```bash
npm install
npm run dev
```

The dev server needs the D1 API routes to work locally too:

```bash
npm run build
npx wrangler dev
```

## One-time setup

### 1. Render the base map

Already generated and committed (`public/basemap.png` + `src/basemap-config.json`).
Re-run only if the source PDF changes:

```bash
pip install pymupdf numpy
python3 scripts/render-basemap.py
```

### 2. Provision D1

```bash
npx wrangler d1 create retail-map-db
# paste the returned database_id into wrangler.toml
npx wrangler d1 execute retail-map-db --remote --file=schema.sql
```

## Data pipeline (bulk points)

The primary path is the app's own **Bulk Upload** panel: upload an Excel
file with columns `name, category, lat, lng, address, status, source,
last_updated` (same convention as CM Land Tracker) and it's parsed
client-side and posted to `/api/points/bulk`.

Start from [`templates/points-bulk-upload-template.xlsx`](templates/points-bulk-upload-template.xlsx)
-- it has the correct headers, a category/status dropdown on each row, 3
sample rows to replace, and a "Read Me" sheet with instructions.

For scripted/CLI imports, `scripts/excel-to-geojson.py` can push the same
rows straight into a deployed instance:

```bash
pip install -r scripts/requirements.txt

# fill in missing lat/lng from address, if needed
python scripts/geocode.py data-sources/grocery.xlsx

# push straight into the deployed D1 database
python scripts/excel-to-geojson.py data-sources/grocery.xlsx --api-url https://retailmap.<your-subdomain>.workers.dev
```

## Icon customization

Default category → color/shape mirrors the original Avison Young legend
(`src/styles/categories.js`: `DEFAULT_CATEGORIES`). The **Category Icons**
panel in the app lets you override color/shape per category without
touching code; overrides are saved to D1 (`category_styles` table) and
picked up by both the interactive map and the print export.

## Build & deploy

```bash
npm run build   # outputs to dist/
```

Deploy path is GitHub → Cloudflare Workers, via "Create a Worker" → connect
to this repo in the Cloudflare dashboard, with:
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Production branch: `master`
- A D1 binding (`DB` → `retail-map-db`) added under the Worker's
  Settings → Bindings.

## Layers

| Layer | Source | Toggle |
|---|---|---|
| Base map | `public/basemap.png` (raster, georeferenced) | — |
| Retail points | D1 via `/api/points` | `#toggle-points` |

## Print export

The "Export A1" / "Export A0" buttons capture the live MapLibre canvas
(`preserveDrawingBuffer: true` is set in `src/map.js`) and composite it with
a vector-drawn legend via jsPDF (`src/export.js`).
