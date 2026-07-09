#!/usr/bin/env python3
"""Convert curated retail Excel files into a POI GeoJSON.

Run manually, per data refresh:

    python scripts/excel-to-geojson.py data-sources/grocery.xlsx data/retail-pois.geojson

Each input Excel file is expected to have one sheet with the fixed POI
schema: name, category, lat, lng, address, status, source, last_updated.
Rows missing lat/lng should be run through geocode.py first.

Multiple input files may be passed; their rows are merged into one
FeatureCollection.
"""
import argparse
import json
import sys

import pandas as pd

REQUIRED_COLUMNS = [
    "name",
    "category",
    "lat",
    "lng",
    "address",
    "status",
    "source",
    "last_updated",
]


def load_rows(excel_path):
    df = pd.read_excel(excel_path)
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise SystemExit(f"{excel_path}: missing required columns {missing}")
    return df[REQUIRED_COLUMNS].to_dict(orient="records")


def rows_to_geojson(rows):
    features = []
    for row in rows:
        if pd.isna(row["lat"]) or pd.isna(row["lng"]):
            print(f"skipping '{row['name']}': no lat/lng (run geocode.py first)", file=sys.stderr)
            continue
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [float(row["lng"]), float(row["lat"])]},
            "properties": {k: row[k] for k in REQUIRED_COLUMNS if k not in ("lat", "lng")},
        })
    return {"type": "FeatureCollection", "features": features}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("excel_files", nargs="+", help="one or more source Excel files")
    parser.add_argument("output", help="output GeoJSON path, e.g. data/retail-pois.geojson")
    args = parser.parse_args()

    all_rows = []
    for path in args.excel_files:
        all_rows.extend(load_rows(path))

    geojson = rows_to_geojson(all_rows)
    with open(args.output, "w") as f:
        json.dump(geojson, f, indent=2)
    print(f"wrote {len(geojson['features'])} POIs to {args.output}")


if __name__ == "__main__":
    main()
