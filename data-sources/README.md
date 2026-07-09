# data-sources

Drop curated Excel files here, one per retail category (e.g. `grocery.xlsx`,
`pharmacy.xlsx`, `fitness.xlsx`, `specialty.xlsx`).

Each file must have a sheet with these columns:

| column | notes |
|---|---|
| `name` | banner / tenant name |
| `category` | must match a category key in `src/styles/categories.js` |
| `lat`, `lng` | leave blank and run `scripts/geocode.py` to fill from `address` |
| `address` | street address |
| `status` | `open` or `closed` |
| `source` | e.g. `curated-excel`, `osm-supplement` |
| `last_updated` | `YYYY-MM-DD` |

These files are not committed with real tenant data by default — treat them
as the private source of truth and only commit sanitized/mock versions if
sharing the repo publicly.

Run the pipeline:

```
python scripts/geocode.py data-sources/grocery.xlsx
python scripts/excel-to-geojson.py data-sources/*.xlsx data/retail-pois.geojson
```
