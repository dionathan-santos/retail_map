# Edmonton Retail Market Intelligence Map

Interactive retail market intelligence map for Edmonton, AB — a sub-application
of the CM Land Tracker Firebase project, reusing its layer-toggle and export
patterns. See `RETAIL_MAP_SPEC.md` (project spec) for full architecture
rationale.

## Stack

- **Map renderer:** MapLibre GL JS
- **Basemap tiles:** Protomaps, served from Cloudflare R2 (placeholder URL in
  `src/map.js` until the real bucket is provisioned)
- **Hosting:** Cloudflare Pages
- **Print export:** client-side canvas capture + jsPDF (no server rendering)

## Local development

```bash
npm install
npm run dev
```

This serves the app with mock data from `/data/*.geojson`. The basemap tile
source is a placeholder until a real Protomaps R2 bucket URL is set in
`src/map.js` — data layers (POIs, zones, ASP polygons, traffic labels) all
render against the placeholder background.

## Data pipeline

```bash
pip install -r scripts/requirements.txt

# 1. Enrich curated Excel rows missing lat/lng
python scripts/geocode.py data-sources/grocery.xlsx

# 2. Convert curated Excel -> POI GeoJSON
python scripts/excel-to-geojson.py data-sources/*.xlsx data/retail-pois.geojson

# 3. Refresh traffic counts from open data
python scripts/fetch-traffic.py data/traffic-counts.geojson
```

Retail zone boundaries (`data/retail-zones.geojson`) and ASP polygons
(`data/asp-polygons.geojson`) are manually digitized — there's no reliable
public source, so edit those GeoJSON files directly (e.g. in geojson.io) when
boundaries change.

This is a manually-triggered pipeline for v1 (see spec §4) — no GitHub Action
watches `data-sources/` yet. That's a reasonable next step once the manual
flow proves out.

## Build & deploy

```bash
npm run build   # outputs to dist/
```

Deploy path is GitHub → Cloudflare Pages (`wrangler.toml`). Connect the repo
in the Cloudflare Pages dashboard for auto-deploy on push to `main`.

## Layers

| Layer | Source | Toggle |
|---|---|---|
| Retail POIs | `data/retail-pois.geojson` | `#toggle-pois` |
| Retail zones | `data/retail-zones.geojson` | `#toggle-zones` |
| ASP polygons (population) | `data/asp-polygons.geojson` | `#toggle-asp` |
| Traffic counts | `data/traffic-counts.geojson` | `#toggle-traffic` |

## Print export

The "Export A1" / "Export A0" buttons capture the live MapLibre canvas
(`preserveDrawingBuffer: true` is set in `src/map.js`) and composite it with
a vector-drawn legend via jsPDF (`src/export.js`).
