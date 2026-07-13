export function renderLegendPanel(categories) {
  const panel = document.getElementById("legend-panel");
  panel.innerHTML = "<h3>Legend</h3>";

  for (const { label, color } of Object.values(categories)) {
    const row = document.createElement("div");
    row.className = "legend-row";
    row.innerHTML = `<span class="legend-swatch" style="background:${color}"></span><span>${label}</span>`;
    panel.appendChild(row);
  }
}
