#!/usr/bin/env python3
"""One-time enrichment: fill missing lat/lng in a curated Excel file from its address column.

Uses OpenStreetMap Nominatim (no API key, low rate limit) since this is a
low-volume, occasional-use script, not a production geocoding pipeline.

    python scripts/geocode.py data-sources/grocery.xlsx

Writes lat/lng back into the same file in place. Rows that already have
lat/lng are left untouched; rows Nominatim can't resolve are left blank
for manual follow-up.
"""
import argparse
import time

import pandas as pd
import requests

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "retail-map-geocoder/1.0 (internal CRE data enrichment)"


def geocode_address(address):
    params = {"q": f"{address}, Edmonton, AB, Canada", "format": "json", "limit": 1}
    resp = requests.get(NOMINATIM_URL, params=params, headers={"User-Agent": USER_AGENT}, timeout=10)
    resp.raise_for_status()
    results = resp.json()
    if not results:
        return None, None
    return float(results[0]["lat"]), float(results[0]["lon"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("excel_file")
    args = parser.parse_args()

    df = pd.read_excel(args.excel_file)
    for col in ("lat", "lng"):
        if col not in df.columns:
            df[col] = None

    for idx, row in df.iterrows():
        if pd.notna(row.get("lat")) and pd.notna(row.get("lng")):
            continue
        lat, lng = geocode_address(row["address"])
        if lat is None:
            print(f"could not geocode: {row['address']}")
        else:
            df.at[idx, "lat"] = lat
            df.at[idx, "lng"] = lng
        time.sleep(1)  # respect Nominatim's 1 req/sec usage policy

    df.to_excel(args.excel_file, index=False)
    print(f"updated {args.excel_file}")


if __name__ == "__main__":
    main()
