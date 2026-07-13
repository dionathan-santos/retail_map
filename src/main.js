import { initMap } from "./map.js";
import { renderLayerTogglePanel } from "./components/layer-toggle-panel.js";
import { renderLegendPanel } from "./components/legend-panel.js";
import { renderPointForm } from "./components/point-form.js";
import { renderBulkUpload } from "./components/bulk-upload.js";
import { renderCategoryStylePicker } from "./components/category-style-picker.js";
import { renderIconBank } from "./components/icon-bank.js";
import { exportMapToPdf } from "./export.js";

async function main() {
  const map = await initMap();

  map.on("load", () => {
    renderLayerTogglePanel(map);
    renderLegendPanel(map.categories);
    renderPointForm(map, map.categories);
    renderBulkUpload(map);
    renderIconBank(map, map.categories);
    renderCategoryStylePicker(map, map.categories);
  });

  document.getElementById("export-a1").addEventListener("click", () => exportMapToPdf(map, { size: "A1" }));
  document.getElementById("export-a0").addEventListener("click", () => exportMapToPdf(map, { size: "A0" }));
}

main();
