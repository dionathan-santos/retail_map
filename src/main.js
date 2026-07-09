import { initMap } from "./map.js";
import { renderLayerTogglePanel } from "./components/layer-toggle-panel.js";
import { renderLegendPanel } from "./components/legend-panel.js";
import { exportMapToPdf } from "./export.js";

const map = initMap();

map.on("load", () => {
  renderLayerTogglePanel(map);
  renderLegendPanel();
});

document.getElementById("export-a1").addEventListener("click", () => exportMapToPdf(map, { size: "A1" }));
document.getElementById("export-a0").addEventListener("click", () => exportMapToPdf(map, { size: "A0" }));
