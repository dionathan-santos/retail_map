"""
Renders assets/source/Retail map_no icons.pdf to a high-res PNG and computes
the lat/lng of its 4 corners using the existing georef transform, for use as
a MapLibre raster/image source (Option A from RETAIL_MAP_SPEC_v2.md).

Usage:
    pip install pymupdf numpy
    python3 scripts/render-basemap.py
"""

import json
import sys
from pathlib import Path

import fitz

sys.path.insert(0, str(Path(__file__).parent.parent / "assets" / "source"))
from georef_transform import pdf_to_latlng  # noqa: E402

SOURCE_PDF = Path(__file__).parent.parent / "assets" / "source" / "Retail map_no icons.pdf"
OUT_PNG = Path(__file__).parent.parent / "public" / "basemap.png"
OUT_CONFIG = Path(__file__).parent.parent / "src" / "basemap-config.json"
SCALE = 6  # 6x -> ~3672x4752px, high enough for A0/A1 print export


def main():
    doc = fitz.open(SOURCE_PDF)
    page = doc[0]
    width_pt, height_pt = page.rect.width, page.rect.height

    mat = fitz.Matrix(SCALE, SCALE)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    OUT_PNG.parent.mkdir(exist_ok=True)
    pix.save(OUT_PNG)

    # PDF-point space here has origin top-left, y increasing downward
    # (confirmed against gcp_points.csv) -- same convention as image pixels,
    # so the raster's 4 corners map directly onto the 4 PDF corners.
    top_left = pdf_to_latlng(0, 0)
    top_right = pdf_to_latlng(width_pt, 0)
    bottom_right = pdf_to_latlng(width_pt, height_pt)
    bottom_left = pdf_to_latlng(0, height_pt)

    # MapLibre image source expects [lng, lat] corners in order:
    # top-left, top-right, bottom-right, bottom-left
    coordinates = [
        [top_left[1], top_left[0]],
        [top_right[1], top_right[0]],
        [bottom_right[1], bottom_right[0]],
        [bottom_left[1], bottom_left[0]],
    ]

    config = {
        "url": "/basemap.png",
        "coordinates": coordinates,
        "pixelWidth": pix.width,
        "pixelHeight": pix.height,
        "sourcePdfPoints": {"width": width_pt, "height": height_pt},
        "scale": SCALE,
    }
    OUT_CONFIG.write_text(json.dumps(config, indent=2) + "\n")

    print(f"Wrote {OUT_PNG} ({pix.width}x{pix.height}px)")
    print(f"Wrote {OUT_CONFIG}")
    print(json.dumps(config, indent=2))


if __name__ == "__main__":
    main()
