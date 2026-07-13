#!/usr/bin/env python3
"""Convert curated retail Excel files into POI GeoJSON, or push them
straight into the deployed app's D1-backed API.

The web app's own "Bulk Upload" panel (src/components/bulk-upload.js) is
the primary path for plotting points now -- it parses the same Excel
schema client-side and posts to the same /api/points/bulk endpoint this
script can hit with --api-url. This script remains useful for scripted/
CLI imports and for producing a local GeoJSON preview.

    # write a local GeoJSON preview
    python scripts/excel-to-geojson.py data-sources/grocery.xlsx preview.geojson

    # push straight into a deployed instance's D1 database
    python scripts/excel-to-geojson.py data-sources/grocery.xlsx --api-url https://retail-map.pages.dev

Each input Excel file is expected to have one sheet with the fixed points
schema: name, category, lat, lng, address, status, source, last_updated.
Rows missing lat/lng should be run through geocode.py first.

Multiple input files may be passed; their rows are merged into one
FeatureCollection / bulk-insert request.
"""
import argparse
import json
import sys

import pandas as pd
import requests

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


def valid_rows(rows):
    out = []
    for row in rows:
        if pd.isna(row["lat"]) or pd.isna(row["lng"]):
            print(f"skipping '{row['name']}': no lat/lng (run geocode.py first)", file=sys.stderr)
            continue
        out.append(row)
    return out


def rows_to_geojson(rows):
    features = []
    for row in valid_rows(rows):
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [float(row["lng"]), float(row["lat"])]},
            "properties": {k: row[k] for k in REQUIRED_COLUMNS if k not in ("lat", "lng")},
        })
    return {"type": "FeatureCollection", "features": features}


def rows_to_points(rows):
    points = []
    for row in valid_rows(rows):
        points.append({
            **{k: (None if pd.isna(row[k]) else row[k]) for k in REQUIRED_COLUMNS},
            "lat": float(row["lat"]),
            "lng": float(row["lng"]),
        })
    return points


def push_to_api(points, api_url):
    resp = requests.post(f"{api_url.rstrip('/')}/api/points/bulk", json={"points": points}, timeout=30)
    resp.raise_for_status()
    return resp.json()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("excel_files", nargs="+", help="one or more source Excel files")
    parser.add_argument("output", nargs="?", help="output GeoJSON path (omit when using --api-url)")
    parser.add_argument("--api-url", help="deployed app base URL, e.g. https://retail-map.pages.dev")
    args = parser.parse_args()

    all_rows = []
    for path in args.excel_files:
        all_rows.extend(load_rows(path))

    if args.api_url:
        result = push_to_api(rows_to_points(all_rows), args.api_url)
        print(f"inserted {result.get('inserted', 0)} point(s) via {args.api_url}")
        if result.get("errors"):
            print(f"{len(result['errors'])} row(s) rejected: {result['errors']}", file=sys.stderr)
        return

    if not args.output:
        raise SystemExit("output path is required unless --api-url is used")

    geojson = rows_to_geojson(all_rows)
    with open(args.output, "w") as f:
        json.dump(geojson, f, indent=2)
    print(f"wrote {len(geojson['features'])} POIs to {args.output}")


if __name__ == "__main__":
    main()
