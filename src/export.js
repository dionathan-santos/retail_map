import { jsPDF } from "jspdf";

// Print sizes in points (72pt/in), landscape.
const PAGE_SIZES = {
  A1: { width: 1683.78, height: 2383.94 },
  A0: { width: 2383.94, height: 3370.87 },
};

/**
 * Captures the current MapLibre canvas and composites it with a vector
 * legend into a print-quality PDF. Mirrors CM Land Tracker's "Export Area
 * as Image" button, swapping PNG output for a paginated PDF sized for
 * A0/A1 plotting.
 */
export async function exportMapToPdf(map, { size = "A1" } = {}) {
  const { width, height } = PAGE_SIZES[size];
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: [height, width] });

  // Force a redraw so preserveDrawingBuffer contains the latest frame.
  map.triggerRepaint();
  await waitForNextFrame(map);

  const canvas = map.getCanvas();
  const imageData = canvas.toDataURL("image/png");

  const mapAreaWidth = width * 0.82;
  pdf.addImage(imageData, "PNG", 0, 0, mapAreaWidth, height);

  drawLegend(pdf, mapAreaWidth, 0, width - mapAreaWidth, height, map.categories);

  pdf.save(`edmonton-retail-map-${size}.pdf`);
}

function waitForNextFrame(map) {
  return new Promise((resolve) => map.once("render", () => requestAnimationFrame(resolve)));
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
