import { initMap } from "./map.js";
import { initDraw } from "./draw.js";
import { renderLayerTogglePanel } from "./components/layer-toggle-panel.js";
import { renderLegendPanel } from "./components/legend-panel.js";
import { renderPointForm } from "./components/point-form.js";
import { renderBulkUpload } from "./components/bulk-upload.js";
import { renderCategoryStylePicker } from "./components/category-style-picker.js";
import { renderIconBank } from "./components/icon-bank.js";
import { renderDrawToolbar } from "./components/draw-toolbar.js";
import { renderProjectsPanel } from "./components/projects-panel.js";
import { exportMapToPdf } from "./export.js";

async function main() {
  const map = await initMap();

  map.on("load", async () => {
    renderLayerTogglePanel(map);
    renderLegendPanel(map.categories);
    renderPointForm(map, map.categories);
    renderBulkUpload(map);
    renderIconBank(map, map.categories);
    renderCategoryStylePicker(map, map.categories);
    renderProjectsPanel(map);

    const drawApi = await initDraw(map);
    renderDrawToolbar(drawApi);
  });

  document.getElementById("export-a1").addEventListener("click", () => exportMapToPdf(map, { size: "A1" }));
  document.getElementById("export-a0").addEventListener("click", () => exportMapToPdf(map, { size: "A0" }));

  document.getElementById("toggle-projects").addEventListener("click", () => {
    document.getElementById("projects-panel").classList.toggle("visible");
  });
}

main();
