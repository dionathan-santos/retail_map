# Edmonton Retail Market Intelligence Map

Interactive retail market intelligence map for Edmonton, AB — a sub-application
of the CM Land Tracker Firebase project, reusing its layer-toggle and export
patterns. See `RETAIL_MAP_SPEC.md` (project spec) for full architecture
rationale.

## Stack

- **Map renderer:** MapLibre GL JS
- **Basemap tiles:** currently [OpenFreeMap](https://openfreemap.org)'s hosted
  `positron` style (free, unlimited, no API key) as a stopgap — see
  `BASEMAP_STYLE_URL` in `src/map.js`. The intended long-term basemap is a
  self-hosted Edmonton-only `.pmtiles` extract on Cloudflare R2, styled via
  `@protomaps/basemaps`' `GRAYSCALE` theme (closest match to the source
  PDF's minimalist line-based look) — see "Building the basemap PMTiles
  file" below.
- **Hosting:** Cloudflare Pages
- **Print export:** client-side canvas capture + jsPDF (no server rendering)

## Local development

```bash
npm install
npm run dev
```

This serves the app with mock data from `/data/*.geojson`, rendered over
OpenFreeMap's hosted `positron` basemap (see `BASEMAP_STYLE_URL` in
`src/map.js`).

### Building the basemap PMTiles file (self-hosted basemap, not wired up yet)

To move off OpenFreeMap onto the self-hosted Edmonton basemap described
under "Stack" above, you'll need a `.pmtiles` file built from an
OpenStreetMap extract (`.osm.pbf`) of the Edmonton region, then wire
`src/map.js` back to a `pmtiles://` vector source styled with
`@protomaps/basemaps` (both are already listed in `package.json`).
Two ways to build the `.pmtiles` file, depending on whether you can
install software locally:

**With Docker installed:**

```bash
git clone https://github.com/protomaps/basemaps.git
cd basemaps/tiles
docker build -t protomaps/basemaps .
docker run -v "$(pwd)/data:/tiles/data" --rm -it protomaps/basemaps \
  --osm-path=data/your-extract.osm.pbf --output=data/edmonton.pmtiles --force
```

**Without installing anything (GitHub Actions):**

Use the `.github/workflows/build-pmtiles.yml` workflow — it does the same
build on GitHub's servers instead of your machine:

1. Upload your `.osm.pbf` extract as a **GitHub Release asset** (repo →
   Releases → Draft a new release → attach the file → publish). Release
   assets support large files via the browser, no `git` needed. Copy the
   asset's download link (right-click it → Copy Link Address).
2. Repo → **Actions** tab → **Build Protomaps PMTiles** workflow → **Run
   workflow** → paste that URL into `osm_pbf_url` → Run.
3. When the run finishes (a few minutes), open it and download the
   `pmtiles-output` artifact from the summary page — it contains the
   `.pmtiles` file.

Either way, the resulting `.pmtiles` file still needs to be uploaded to a
Cloudflare R2 bucket, and `src/map.js` updated to point at it.

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

### Digitizing zones & ASP polygons in-app

Instead of editing GeoJSON by hand, retail zones and ASP polygons can be
drawn directly on the map using the "Draw on Map" panel (top-right):
pick a layer, draw the polygon, and fill in its attributes (zone
name/tier, or ASP population/households/income) when prompted.

Click **Edit**, then click a drawn shape, to select it — the "Shape
Style" section appears with controls for fill colour, fill opacity,
line colour, and line width. **Apply** writes the override onto that
one feature; **Reset to Default** clears it back to the layer's default
style.

Drawn shapes are persisted to a Cloudflare D1 database via
`functions/api/features/[layerKey].js`, with `localStorage` as a local
cache/fallback (used automatically if the API is unreachable — e.g.
offline, or running `npm run dev` without `wrangler pages dev`, since
Vite's dev server doesn't run Pages Functions). Use "Export GeoJSON" any
time to download the current shapes as a backup or to seed
`data/retail-zones.geojson` / `data/asp-polygons.geojson` for the
non-editable baseline layers.

### Persisting drawn shapes (Cloudflare D1)

One-time setup, done in the Cloudflare dashboard:

1. **Workers & Pages → D1 → Create database.** Name it e.g. `retail-map-db`.
2. Open the new database → **Console** tab → paste the contents of
   `schema.sql` (repo root) → **Execute**. This creates the one table the
   API uses.
3. Go to your **Pages project → Settings → Functions → D1 database
   bindings → Add binding**. Variable name: `DB`. D1 database: the one you
   just created. Save.
4. Trigger a new deploy (push anything to `master`, or use "Retry
   deployment" on the latest one in the Pages dashboard) so the binding
   takes effect.

That's it — the "Draw on Map" panel will start saving to D1
automatically once the binding exists. No code changes needed for this
part.

## Build & deploy

```bash
npm run build   # outputs to dist/
```

Deploy path is GitHub → Cloudflare Pages (`wrangler.toml`). Connect the repo
in the Cloudflare Pages dashboard for auto-deploy on push to `master`.

## Layers

| Layer | Source | Toggle |
|---|---|---|
| Retail POIs | `data/retail-pois.geojson` | `#toggle-pois` |
| Retail zones | `data/retail-zones.geojson` | `#toggle-zones` |
| ASP polygons (population) | `data/asp-polygons.geojson` | `#toggle-asp` |
| Traffic counts | `data/traffic-counts.geojson` | `#toggle-traffic` |
| Residential areas | `data/residential-areas.geojson` | `#toggle-residential` |
| Employment areas | `data/employment-areas.geojson` | `#toggle-employment` |
| LRT (current/future) | `data/lrt-lines.geojson` | `#toggle-lrt` |
| Enclosed malls (numbered, GLA) | `data/enclosed-malls.geojson` | `#toggle-malls` |

## Print export

The "Export A1" / "Export A0" buttons capture the live MapLibre canvas
(`preserveDrawingBuffer: true` is set in `src/map.js`) and composite it with
a vector-drawn legend via jsPDF (`src/export.js`).
