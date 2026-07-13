import { TOGGLEABLE_LAYERS, setLayerVisibility } from "../map.js";

const LAYER_LABELS = {
  "toggle-pois": "Retail POIs",
  "toggle-zones": "Retail Zones",
  "toggle-asp": "ASP / Population",
  "toggle-traffic": "Traffic Counts",
  "toggle-residential": "Residential Areas",
  "toggle-employment": "Employment Areas",
  "toggle-lrt": "LRT (Current/Future)",
};

export function renderLayerTogglePanel(map) {
  const panel = document.getElementById("layer-toggle-panel");
  panel.innerHTML = "<h3>Layers</h3>";

  for (const [id, layerIds] of Object.entries(TOGGLEABLE_LAYERS)) {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = id;
    checkbox.checked = true;
    checkbox.addEventListener("change", () => {
      setLayerVisibility(map, layerIds, checkbox.checked);
    });

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(LAYER_LABELS[id]));
    panel.appendChild(label);
  }
}
