import { createDrawTool } from "./draw-tool.js";

const DRAWABLE_LAYERS = {
  "retail-zones": "Zonas de Varejo",
  "asp-polygons": "Polígonos ASP",
};

/**
 * Renders the "digitize on the map" panel: pick which layer you're
 * drawing (zones or ASP polygons), then draw / edit / clear / export.
 */
export function renderDrawToolbar(map) {
  const panel = document.getElementById("draw-panel");
  panel.innerHTML = "<h3>Desenhar no mapa</h3>";

  const select = document.createElement("select");
  for (const [key, label] of Object.entries(DRAWABLE_LAYERS)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = label;
    select.appendChild(option);
  }
  panel.appendChild(select);

  const tool = createDrawTool(map);
  select.addEventListener("change", async () => tool.setActiveLayer(select.value));
  tool.setActiveLayer(select.value);

  const buttonRow = document.createElement("div");
  buttonRow.className = "draw-toolbar-buttons";
  panel.appendChild(buttonRow);

  addButton(buttonRow, "Desenhar", () => tool.startDrawing());
  addButton(buttonRow, "Editar", () => tool.startEditing());
  addButton(buttonRow, "Parar", () => tool.stopDrawing());
  addButton(buttonRow, "Exportar GeoJSON", () => tool.exportGeoJson());
  addButton(buttonRow, "Limpar", () => {
    if (window.confirm("Apagar todos os desenhos desta camada?")) tool.clear();
  });
}

function addButton(container, label, onClick) {
  const button = document.createElement("button");
  button.textContent = label;
  button.addEventListener("click", onClick);
  container.appendChild(button);
}
