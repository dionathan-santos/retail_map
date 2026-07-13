// Draw/edit freeform polygons (retail trade areas, custom zones, etc.) on
// top of the map -- distinct from the fixed-category points. Backed by
// src/draw.js (Terra Draw), persisted to D1 via /api/shapes.
export function renderDrawToolbar(drawApi) {
  const panel = document.getElementById("draw-panel");
  panel.innerHTML = `
    <h3>Shapes</h3>
    <div class="draw-toolbar-buttons">
      <button type="button" id="draw-polygon">Draw Polygon</button>
      <button type="button" id="draw-select">Select / Edit</button>
      <button type="button" id="draw-delete">Delete Selected</button>
    </div>
    <div class="style-editor">
      <label>Color <input type="color" id="draw-color" value="#5B3A9B" /></label>
      <label>Fill opacity
        <input type="range" id="draw-opacity" min="0" max="1" step="0.05" value="0.3" />
      </label>
    </div>
  `;

  const { draw } = drawApi;

  panel.querySelector("#draw-polygon").addEventListener("click", () => draw.setMode("polygon"));
  panel.querySelector("#draw-select").addEventListener("click", () => draw.setMode("select"));
  panel.querySelector("#draw-delete").addEventListener("click", () => drawApi.deleteSelected());

  const colorInput = panel.querySelector("#draw-color");
  const opacityInput = panel.querySelector("#draw-opacity");

  colorInput.addEventListener("input", () => {
    const style = { color: colorInput.value };
    drawApi.setCurrentStyle(style);
    drawApi.applyStyleToSelected(style);
  });

  opacityInput.addEventListener("input", () => {
    const style = { fillOpacity: Number(opacityInput.value) };
    drawApi.setCurrentStyle(style);
    drawApi.applyStyleToSelected(style);
  });
}
