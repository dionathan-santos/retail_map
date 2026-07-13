import { jsPDF } from "jspdf";

// Print sizes in points (72pt/in), landscape.
const PAGE_SIZES = {
  A1: { width: 1683.78, height: 2383.94 },
  A0: { width: 2383.94, height: 3370.87 },
};

// Print-quality resolution for the exported raster. 150 DPI is a standard
// large-format print resolution and keeps the captured canvas comfortably
// under typical GPU max-texture-size limits (~8k-16k px) even at A0.
const EXPORT_DPI = 150;

/**
 * Captures the current MapLibre view at print resolution and composites it
 * with a vector legend into a print-quality PDF. Mirrors CM Land Tracker's
 * "Export Area as Image" button, swapping PNG output for a paginated PDF
 * sized for A0/A1 plotting.
 */
// Legend is disabled for now (map-only export requested) -- set this back
// to true, and mapAreaWidthPt below back to `width * 0.82`, to bring it back.
const INCLUDE_LEGEND = false;

export async function exportMapToPdf(map, { size = "A1" } = {}) {
  const { width, height } = PAGE_SIZES[size];
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: [height, width] });

  const mapAreaWidthPt = INCLUDE_LEGEND ? width * 0.82 : width;
  const pxWidth = Math.round((mapAreaWidthPt / 72) * EXPORT_DPI);
  const pxHeight = Math.round((height / 72) * EXPORT_DPI);

  const imageData = await captureAtResolution(map, pxWidth, pxHeight);

  // pxWidth/pxHeight share the exact aspect ratio of mapAreaWidthPt/height,
  // so this never stretches the captured image.
  pdf.addImage(imageData, "PNG", 0, 0, mapAreaWidthPt, height);

  if (INCLUDE_LEGEND) {
    drawLegend(pdf, mapAreaWidthPt, 0, width - mapAreaWidthPt, height, map.categories);
  }

  pdf.save(`edmonton-retail-map-${size}.pdf`);
}

// Temporarily grows the live map's canvas to the target print resolution
// (off-screen, so the visible UI doesn't jump), waits for it to fully
// re-render at that size, captures a PNG, then restores the original size.
async function captureAtResolution(map, pxWidth, pxHeight) {
  const container = map.getContainer();
  const original = {
    position: container.style.position,
    left: container.style.left,
    top: container.style.top,
    width: container.style.width,
    height: container.style.height,
    zIndex: container.style.zIndex,
  };
  // A bigger canvas at the same zoom level shows MORE geographic area, not
  // just a higher-res version of the same view -- re-fit the pre-resize
  // bounds afterwards so the captured frame matches what's on screen.
  const originalView = { center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
  const bounds = map.getBounds();

  container.style.position = "fixed";
  container.style.left = "-100000px";
  container.style.top = "0";
  container.style.width = `${pxWidth}px`;
  container.style.height = `${pxHeight}px`;
  container.style.zIndex = "-1";

  try {
    map.resize();
    map.fitBounds(bounds, { animate: false, padding: 0 });
    map.triggerRepaint();
    await waitForIdle(map);

    return map.getCanvas().toDataURL("image/png");
  } finally {
    container.style.position = original.position;
    container.style.left = original.left;
    container.style.top = original.top;
    container.style.width = original.width;
    container.style.height = original.height;
    container.style.zIndex = original.zIndex;
    map.resize();
    map.jumpTo(originalView);
  }
}

function waitForIdle(map) {
  return new Promise((resolve) => map.once("idle", () => requestAnimationFrame(resolve)));
}

function drawLegend(pdf, x, y, panelWidth, panelHeight, categories) {
  const padding = 24;
  let cursorY = y + padding + 20;

  pdf.setFillColor("#FFFFFF");
  pdf.rect(x, y, panelWidth, panelHeight, "F");

  pdf.setFontSize(16);
  pdf.setTextColor("#1F4E79");
  pdf.text("Legend", x + padding, cursorY);
  cursorY += 28;

  pdf.setFontSize(11);
  for (const { label, color } of Object.values(categories)) {
    pdf.setFillColor(color);
    pdf.circle(x + padding + 6, cursorY - 4, 6, "F");
    pdf.setTextColor("#1A1A1A");
    pdf.text(label, x + padding + 22, cursorY);
    cursorY += 22;
  }
}
