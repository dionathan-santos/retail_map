"""
Edmonton Retail Map - Georeferencing Transform
================================================
Converts between PDF/AI coordinate space (points, 612x792 pt page)
and real-world lat/lng, using an affine transform fitted from
12 manually-clicked ground control points (GCPs).

Fit quality: ~72m RMS error on 3 held-out validation points
(not used to build the transform).

Usage:
    from georef_transform import pdf_to_latlng, latlng_to_pdf

    lat, lng = pdf_to_latlng(293.7, 368.1)
    x_pdf, y_pdf = latlng_to_pdf(53.5410, -113.5086)
"""

import numpy as np

# Affine coefficients: lat = A*x + B*y + C ; lng = D*x + E*y + F
_COEF_LAT = np.array([-6.88875213e-07, -6.94089680e-04, 5.37955094e+01])
_COEF_LNG = np.array([1.16913960e-03, 2.14955514e-06, -1.13849672e+02])

# Source PDF page size (pts) this transform was fitted against
PDF_PAGE_WIDTH = 612.0
PDF_PAGE_HEIGHT = 792.0


def pdf_to_latlng(x_pdf: float, y_pdf: float) -> tuple[float, float]:
    """Convert a PDF-point coordinate to (lat, lng)."""
    lat = _COEF_LAT[0] * x_pdf + _COEF_LAT[1] * y_pdf + _COEF_LAT[2]
    lng = _COEF_LNG[0] * x_pdf + _COEF_LNG[1] * y_pdf + _COEF_LNG[2]
    return lat, lng


def latlng_to_pdf(lat: float, lng: float) -> tuple[float, float]:
    """
    Convert (lat, lng) back to PDF-point coordinates.
    Solves the inverse of the affine system (2x2 linear solve).
    """
    # lat - C = A*x + B*y
    # lng - F = D*x + E*y
    A, B, C = _COEF_LAT
    D, E, F = _COEF_LNG
    M = np.array([[A, B], [D, E]])
    rhs = np.array([lat - C, lng - F])
    x_pdf, y_pdf = np.linalg.solve(M, rhs)
    return x_pdf, y_pdf


def haversine_m(lat1, lng1, lat2, lng2):
    """Distance in meters between two lat/lng points."""
    R = 6371000
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dphi = np.radians(lat2 - lat1)
    dlmb = np.radians(lng2 - lng1)
    a = np.sin(dphi / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dlmb / 2) ** 2
    return 2 * R * np.arcsin(np.sqrt(a))


if __name__ == "__main__":
    # quick self-test using a known GCP
    lat, lng = pdf_to_latlng(293.7, 368.1)
    print(f"pdf(293.7, 368.1) -> lat={lat:.5f}, lng={lng:.5f}")

    x, y = latlng_to_pdf(lat, lng)
    print(f"round-trip -> x_pdf={x:.1f}, y_pdf={y:.1f}")
