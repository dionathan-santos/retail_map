import { CATEGORIES } from "../styles/categories.js";

export function renderLegendPanel() {
  const panel = document.getElementById("legend-panel");
  panel.innerHTML = "<h3>Legend</h3>";

  for (const { label, color } of Object.values(CATEGORIES)) {
    const row = document.createElement("div");
    row.className = "legend-row";
    row.innerHTML = `<span class="legend-swatch" style="background:${color}"></span><span>${label}</span>`;
    panel.appendChild(row);
  }

  const zoneMajor = document.createElement("div");
  zoneMajor.className = "legend-row";
  zoneMajor.innerHTML = `<span class="legend-line"></span><span>Major retail zone</span>`;
  panel.appendChild(zoneMajor);

  const zoneSecondary = document.createElement("div");
  zoneSecondary.className = "legend-row";
  zoneSecondary.innerHTML = `<span class="legend-line secondary"></span><span>Secondary retail zone</span>`;
  panel.appendChild(zoneSecondary);

  const lrt = document.createElement("div");
  lrt.className = "legend-row";
  lrt.innerHTML = `<span class="legend-line lrt"></span><span>LRT (Current/Future)</span>`;
  panel.appendChild(lrt);

  const residential = document.createElement("div");
  residential.className = "legend-row";
  residential.innerHTML = `<span class="legend-swatch legend-swatch-square residential"></span><span>Residential area</span>`;
  panel.appendChild(residential);

  const employment = document.createElement("div");
  employment.className = "legend-row";
  employment.innerHTML = `<span class="legend-swatch legend-swatch-square employment"></span><span>Employment area</span>`;
  panel.appendChild(employment);
}
