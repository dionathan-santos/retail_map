/**
 * Edmonton Retail Map - Georeferencing Transform (JS)
 * ====================================================
 * Same affine transform as georef_transform.py.
 * Fit quality: ~72m RMS error on 3 held-out validation points.
 */

const COEF_LAT = [-6.88875213e-07, -6.94089680e-04, 5.37955094e+01]; // A, B, C
const COEF_LNG = [1.16913960e-03, 2.14955514e-06, -1.13849672e+02];  // D, E, F

const PDF_PAGE_WIDTH = 612.0;
const PDF_PAGE_HEIGHT = 792.0;

function pdfToLatLng(xPdf, yPdf) {
  const [A, B, C] = COEF_LAT;
  const [D, E, F] = COEF_LNG;
  const lat = A * xPdf + B * yPdf + C;
  const lng = D * xPdf + E * yPdf + F;
  return { lat, lng };
}

function latLngToPdf(lat, lng) {
  const [A, B, C] = COEF_LAT;
  const [D, E, F] = COEF_LNG;
  const det = A * E - B * D;
  const rhs0 = lat - C;
  const rhs1 = lng - F;
  const x = (rhs0 * E - B * rhs1) / det;
  const y = (A * rhs1 - rhs0 * D) / det;
  return { x, y };
}

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dlmb = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dlmb / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

module.exports = { pdfToLatLng, latLngToPdf, haversineM, PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT };
