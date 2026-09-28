"""
Fits the affine transform (PDF-point space -> lat/lng) from a GCP CSV and
writes the coefficients into assets/source/georef_transform.py and
assets/source/georefTransform.js.

Usage:
    pip install numpy
    python3 scripts/fit-georef-transform.py assets/source/gcp_points.csv \
        --pdf-width 1404 --pdf-height 1800
"""

import argparse
import csv
import re
from pathlib import Path

import numpy as np

ROOT = Path(__file__).parent.parent
PY_TRANSFORM = ROOT / "assets" / "source" / "georef_transform.py"
JS_TRANSFORM = ROOT / "assets" / "source" / "georefTransform.js"


def haversine_m(lat1, lng1, lat2, lng2):
    R = 6371000
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dphi = np.radians(lat2 - lat1)
    dlmb = np.radians(lng2 - lng1)
    a = np.sin(dphi / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dlmb / 2) ** 2
    return 2 * R * np.arcsin(np.sqrt(a))


def fit(csv_path):
    rows = list(csv.DictReader(open(csv_path)))
    x = np.array([float(r["x_pdf"]) for r in rows])
    y = np.array([float(r["y_pdf"]) for r in rows])
    lat = np.array([float(r["lat"]) for r in rows])
    lng = np.array([float(r["lng"]) for r in rows])

    M = np.column_stack([x, y, np.ones_like(x)])
    coef_lat, *_ = np.linalg.lstsq(M, lat, rcond=None)
    coef_lng, *_ = np.linalg.lstsq(M, lng, rcond=None)

    pred_lat = M @ coef_lat
    pred_lng = M @ coef_lng
    errs = haversine_m(lat, lng, pred_lat, pred_lng)

    return coef_lat, coef_lng, errs, len(rows)


def update_py(coef_lat, coef_lng, pdf_w, pdf_h, rms, n_gcps):
    a, b, c = (float(v) for v in coef_lat)
    d, e, f = (float(v) for v in coef_lng)

    text = PY_TRANSFORM.read_text()
    text = re.sub(
        r"points, \d+x\d+ pt page",
        f"points, {int(pdf_w)}x{int(pdf_h)} pt page",
        text,
    )
    text = re.sub(r"from\s+\d+ manually-clicked", f"from\n{n_gcps} manually-clicked", text)
    text = re.sub(
        r"Fit quality: ~[\d.]+m RMS error.*",
        f"Fit quality: ~{rms:.0f}m RMS error (fit residual over all {n_gcps} GCPs).",
        text,
    )
    text = re.sub(r"\(not used to build the transform\)\.\n", "", text)
    text = re.sub(
        r"_COEF_LAT = np\.array\(\[.*?\]\)",
        f"_COEF_LAT = np.array([{a!r}, {b!r}, {c!r}])",
        text,
    )
    text = re.sub(
        r"_COEF_LNG = np\.array\(\[.*?\]\)",
        f"_COEF_LNG = np.array([{d!r}, {e!r}, {f!r}])",
        text,
    )
    text = re.sub(r"PDF_PAGE_WIDTH = [\d.]+", f"PDF_PAGE_WIDTH = {pdf_w}", text)
    text = re.sub(r"PDF_PAGE_HEIGHT = [\d.]+", f"PDF_PAGE_HEIGHT = {pdf_h}", text)
    PY_TRANSFORM.write_text(text)


def update_js(coef_lat, coef_lng, pdf_w, pdf_h, rms, n_gcps):
    a, b, c = (float(v) for v in coef_lat)
    d, e, f = (float(v) for v in coef_lng)

    text = JS_TRANSFORM.read_text()
    text = re.sub(
        r"Fit quality: ~[\d.]+m RMS error.*",
        f"Fit quality: ~{rms:.0f}m RMS error (fit residual over all {n_gcps} GCPs).",
        text,
    )
    text = re.sub(
        r"const COEF_LAT = \[.*?\];",
        f"const COEF_LAT = [{a!r}, {b!r}, {c!r}];",
        text,
    )
    text = re.sub(
        r"const COEF_LNG = \[.*?\];",
        f"const COEF_LNG = [{d!r}, {e!r}, {f!r}];",
        text,
    )
    text = re.sub(r"const PDF_PAGE_WIDTH = [\d.]+;", f"const PDF_PAGE_WIDTH = {pdf_w};", text)
    text = re.sub(r"const PDF_PAGE_HEIGHT = [\d.]+;", f"const PDF_PAGE_HEIGHT = {pdf_h};", text)
    JS_TRANSFORM.write_text(text)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("csv_path")
    parser.add_argument("--pdf-width", type=float, required=True)
    parser.add_argument("--pdf-height", type=float, required=True)
    args = parser.parse_args()

    coef_lat, coef_lng, errs, n = fit(args.csv_path)
    rms = float(np.sqrt(np.mean(errs**2)))

    print(f"{n} GCPs")
    print("COEF_LAT (A,B,C):", coef_lat)
    print("COEF_LNG (D,E,F):", coef_lng)
    print("per-point error (m):", np.round(errs, 1))
    print(f"RMS error: {rms:.1f}m, max: {errs.max():.1f}m")

    update_py(coef_lat, coef_lng, args.pdf_width, args.pdf_height, rms, n)
    update_js(coef_lat, coef_lng, args.pdf_width, args.pdf_height, rms, n)
    print(f"Updated {PY_TRANSFORM} and {JS_TRANSFORM}")


if __name__ == "__main__":
    main()
