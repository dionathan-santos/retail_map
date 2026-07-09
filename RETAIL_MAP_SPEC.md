# Edmonton Retail Market Intelligence Map — Project Spec

## 1. Objective

Build an interactive retail market intelligence map for Edmonton, AB, replicating and improving on a static Avison Young retail PDF map. This is a sub-application extending the existing **CM Land Tracker** Firebase project (`cm-land-tracker.web.app`), reusing its layer-toggle system, Firestore data patterns, and image export functionality rather than starting a greenfield repo.

Deliverable: a maintainable web app that renders categorized retail POIs, retail zone boundaries, ASP polygons with population data, and traffic count labels — with high-resolution print export (A0/A1).

## 2. Non-goals

- Do NOT attempt pixel-perfect replication of the source PDF's custom cartographic style (that was produced in ArcGIS Pro / Illustrator as a static marketing asset). Use it only as visual inspiration for color palette, pin hierarchy, and legend structure.
- Do NOT introduce Mapbox Studio, MapTiler, or any tile provider with metered billing risk.
- Do NOT add StackBlitz or any intermediate hosting layer. Deploy path is GitHub → Cloudflare Pages directly.

## 3. Architecture decisions (final — do not re-litigate)

| Concern | Decision | Why |
|---|---|---|
| Map renderer | MapLibre GL JS | Same rendering engine as Mapbox, no token/billing risk |
| Basemap tiles | Protomaps, served from Cloudflare R2 | Free egress, avoids Firebase Hosting bandwidth cap |
| Hosting | Cloudflare Pages | Better free-tier terms for commercial use than Vercel; Firebase Hosting alone ruled out (egress limits) |
| Data layer | Existing Firebase/Firestore project (CM Land Tracker) | ~80% of pipeline already exists (Turf.js, categorized pins, ASP polygon handling) |
| Geospatial processing | Turf.js | Already in use in CM Land Tracker |
| Print export | Client-side: MapLibre canvas capture at inflated resolution + jsPDF | Server-side (Cloudflare Browser Rendering) is more reliable but exits free tier at volume |

## 4. Data pipeline

**Source of truth:** Excel files from internal sources (curated CRE data — bandeira, address, GLA, open/closed status). Prefer this over live APIs (OSM/Google Places lag on closures and mislabel banners); APIs only fill gaps, not replace curated data.

**Supplementary sources:**
- City of Edmonton open data → traffic counts
- Alberta Transportation open data → traffic counts, possibly ASP boundary references
- Retail zone polygons → manually digitized as GeoJSON (no reliable public source)

**Fixed schema per POI row:** `name, category, lat, lng, address, status, source, last_updated`

**Pipeline structure:**
```
/data-sources        # Excel files, one per retail category
/scripts
  geocode.py         # one-time enrichment: address -> lat/lng
  excel-to-geojson.py
  fetch-traffic.py   # pulls City of Edmonton / AB Transportation data
/data                # generated GeoJSON, committed to Git
```

**Open decision (flag, don't resolve automatically):** whether Excel→GeoJSON conversion is a manually triggered local script or a GitHub Action triggered on file upload. Default to manual script for v1; leave a clear extension point to automate later.

## 5. Repo structure to scaffold

```
/retail-map
  /data-sources/
  /scripts/
    geocode.py
    excel-to-geojson.py
    fetch-traffic.py
  /data/
  /src/
    /components/
    /styles/
    map.js            # MapLibre init, layer toggle logic (mirror CM Land Tracker pattern)
    export.js          # canvas capture + jsPDF logic
  index.html
  package.json
  wrangler.toml        # Cloudflare Pages config
  README.md
```

## 6. Visual/brand system

Adopt from the source PDF as *inspiration only*:
- Color palette per retail category (grocery, pharmacy, fitness, specialty, etc.)
- Pin hierarchy and legend structure
- Retail zone line styling (e.g., major vs. secondary zone distinction)

Must remain visually consistent with CM Land Tracker's existing Avison Young brand styling — this is a unified system across both tools, not a separate look.

## 7. Print export requirements

- Trigger: button in UI, mirrors CM Land Tracker's existing "Export Area as Image" pattern where possible.
- Method: `map.getCanvas()` captured at inflated resolution for A0/A1 print quality, composited with a vectorized legend via jsPDF.
- No server-side rendering dependency for v1.

## 8. Build order (suggested for Claude Code)

1. Scaffold repo structure above; initialize Git.
2. Set up MapLibre GL JS + Protomaps tile source pointing to a placeholder R2 bucket URL (to be swapped with real bucket).
3. Build `excel-to-geojson.py` against one sample Excel file (mock data acceptable) → confirm output lands correctly in `/data`.
4. Render mock POI GeoJSON as categorized pins on the map.
5. Add ASP polygon layer (reuse Turf.js patterns from CM Land Tracker if code is available/importable).
6. Add layer toggle UI mirroring CM Land Tracker's panel.
7. Add traffic count labels as map tooltips/labels.
8. Implement print export (canvas + jsPDF).
9. Wire up `wrangler.toml` / Cloudflare Pages deploy config, connect to GitHub for auto-deploy on push.

## 9. Constraints to respect throughout

- Every architecture choice is deliberately optimized to avoid billing exposure (this is an internal/commercial tool, not a funded product).
- Prefer reusing validated CM Land Tracker infrastructure over building new patterns from scratch.
- Keep the data pipeline scripts simple and locally runnable — the person maintaining this is not a full-time backend engineer.
