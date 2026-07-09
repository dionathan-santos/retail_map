#!/usr/bin/env python3
"""Pull traffic count (AADT) data from City of Edmonton / Alberta Transportation open data.

    python scripts/fetch-traffic.py data/traffic-counts.geojson

City of Edmonton's open data portal exposes traffic count stations as a
Socrata dataset; Alberta Transportation publishes provincial highway AADT
separately. Both are fetched and merged into one GeoJSON of point features.

If a source is unreachable (portal changed, network down), the script
skips it and reports what it got — this is a supplementary layer, not the
source of truth.
"""
import argparse
import json
import sys

import requests

CITY_OF_EDMONTON_TRAFFIC_URL = (
    "https://data.edmonton.ca/resource/8h4a-tvim.json"  # traffic flow / count stations
)


def fetch_city_of_edmonton():
    resp = requests.get(CITY_OF_EDMONTON_TRAFFIC_URL, params={"$limit": 5000}, timeout=30)
    resp.raise_for_status()
    features = []
    for row in resp.json():
        try:
            lat = float(row["latitude"])
            lng = float(row["longitude"])
        except (KeyError, ValueError, TypeError):
            continue
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lng, lat]},
            "properties": {
                "location": row.get("location_description", "unknown"),
                "aadt": row.get("aadt"),
                "year": row.get("count_year"),
                "source": "City of Edmonton Open Data",
            },
        })
    return features


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", help="output GeoJSON path, e.g. data/traffic-counts.geojson")
    args = parser.parse_args()

    features = []
    try:
        features.extend(fetch_city_of_edmonton())
    except requests.RequestException as e:
        print(f"City of Edmonton fetch failed: {e}", file=sys.stderr)

    # Alberta Transportation AADT is published as periodic PDF/Excel reports
    # rather than a queryable API as of this writing; add a fetcher here once
    # a stable endpoint is confirmed.

    geojson = {"type": "FeatureCollection", "features": features}
    with open(args.output, "w") as f:
        json.dump(geojson, f, indent=2)
    print(f"wrote {len(features)} traffic count points to {args.output}")


if __name__ == "__main__":
    main()
