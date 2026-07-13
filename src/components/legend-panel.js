import { CATEGORIES } from "../styles/categories.js";

export async function renderLegendPanel() {
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

  await renderEnclosedMallsList(panel);
}

async function renderEnclosedMallsList(panel) {
  const res = await fetch("/data/enclosed-malls.geojson");
  const { features } = await res.json();

  const heading = document.createElement("h3");
  heading.className = "legend-sub-heading";
  heading.textContent = "Enclosed Malls (GLA)";
  panel.appendChild(heading);

  const list = document.createElement("ol");
  list.className = "mall-list";
  for (const { properties } of [...features].sort((a, b) => a.properties.number - b.properties.number)) {
    const item = document.createElement("li");
    item.innerHTML = `${properties.name} <span class="mall-gla">(${Number(properties.gla_sqft).toLocaleString()} sf)</span>`;
    list.appendChild(item);
  }
  panel.appendChild(list);
}
