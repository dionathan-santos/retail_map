/**
 * Edmonton Retail Map - Georeferencing Transform (JS)
 * ====================================================
 * Same affine transform as georef_transform.py.
 * Fit quality: ~62m RMS error (fit residual over all 13 GCPs).
 */

const COEF_LAT = [3.2072916597663463e-07, -0.00024140659421560684, 53.75376597265131]; // A, B, C
const COEF_LNG = [0.0004060013354489014, -3.050634297258048e-07, -113.7464823774099];  // D, E, F

const PDF_PAGE_WIDTH = 1404.0;
const PDF_PAGE_HEIGHT = 1800.0;

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
