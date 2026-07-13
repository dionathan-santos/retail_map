import { createDrawTool } from "./draw-tool.js";

const DRAWABLE_LAYERS = {
  "retail-zones": "Retail Zones",
  "asp-polygons": "ASP Polygons",
};

/**
 * Renders the "digitize on the map" panel: pick which layer you're
 * drawing (zones or ASP polygons), then draw / edit / clear / export,
 * plus a style editor for the shape currently selected in Edit mode.
 */
export function renderDrawToolbar(map) {
  const panel = document.getElementById("draw-panel");
  panel.innerHTML = "<h3>Draw on Map</h3>";

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

  addButton(buttonRow, "Draw", () => tool.startDrawing());
  addButton(buttonRow, "Edit", () => tool.startEditing());
  addButton(buttonRow, "Stop", () => tool.stopDrawing());
  addButton(buttonRow, "Export GeoJSON", () => tool.exportGeoJson());
  addButton(buttonRow, "Clear", () => {
    if (window.confirm("Delete all drawings on this layer?")) tool.clear();
  });

  renderStyleEditor(panel, tool);
}

function addButton(container, label, onClick) {
  const button = document.createElement("button");
  button.textContent = label;
  button.addEventListener("click", onClick);
  container.appendChild(button);
}

// Only meaningful once a shape is selected via the "Edit" button + a click
// on the map — hidden the rest of the time. Lets you override fill colour,
// fill opacity, line colour, and line width per shape.
function renderStyleEditor(panel, tool) {
  const section = document.createElement("div");
  section.id = "style-editor";
  section.className = "style-editor";
  section.hidden = true;
  panel.appendChild(section);

  const heading = document.createElement("h4");
  heading.textContent = "Shape Style";
  section.appendChild(heading);

  const fillColorRow = styleRow(section, "Fill colour", "color");
  const fillOpacityRow = styleRow(section, "Fill opacity", "range", { min: 0, max: 1, step: 0.05 });
  const lineColorRow = styleRow(section, "Line colour", "color");
  const lineWidthRow = styleRow(section, "Line width", "number", { min: 1, max: 12, step: 1 });

  const actions = document.createElement("div");
  actions.className = "draw-toolbar-buttons";
  section.appendChild(actions);

  addButton(actions, "Apply", () => {
    tool.updateSelectedStyle({
      style_fill_color: fillColorRow.input.value,
      style_fill_opacity: Number(fillOpacityRow.input.value),
      style_line_color: lineColorRow.input.value,
      style_line_width: Number(lineWidthRow.input.value),
    });
  });

  addButton(actions, "Reset to Default", () => tool.resetSelectedStyle());

  tool.onSelectionChange((feature) => {
    section.hidden = !feature;
    if (!feature) return;

    const defaults = tool.getDefaultStyle();
    const p = feature.properties || {};
    fillColorRow.input.value = p.style_fill_color || defaults.fillColor;
    fillOpacityRow.input.value = p.style_fill_opacity ?? defaults.fillOpacity;
    lineColorRow.input.value = p.style_line_color || defaults.lineColor;
    lineWidthRow.input.value = p.style_line_width ?? defaults.lineWidth;
  });
}

function styleRow(container, label, type, attrs = {}) {
  const row = document.createElement("label");
  row.className = "style-editor-row";

  const span = document.createElement("span");
  span.textContent = label;
  row.appendChild(span);

  const input = document.createElement("input");
  input.type = type;
  for (const [key, value] of Object.entries(attrs)) input.setAttribute(key, value);
  row.appendChild(input);

  container.appendChild(row);
  return { row, input };
}
