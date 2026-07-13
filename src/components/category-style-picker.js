import { SHAPES } from "../styles/categories.js";
import { saveCategoryStyle } from "../api.js";
import { registerCategoryIcons, refreshPoints } from "../map.js";

// Lets users override icon/color per category without touching code.
// Persists to D1 (functions/api/category-styles.js) and re-registers the
// MapLibre sprite images immediately so both the live map and any export
// pick up the change.
export function renderCategoryStylePicker(map, categories) {
  const panel = document.getElementById("category-style-panel");
  panel.innerHTML = "<h3>Category Icons</h3>";

  for (const [key, style] of Object.entries(categories)) {
    const row = document.createElement("div");
    row.className = "category-style-row";
    row.innerHTML = `
      <span>${style.label}</span>
      <input type="color" value="${style.color}" data-key="${key}" data-field="color" />
      <select data-key="${key}" data-field="shape">
        ${SHAPES.map((s) => `<option value="${s}" ${s === style.shape ? "selected" : ""}>${s}</option>`).join("")}
      </select>
    `;
    panel.appendChild(row);
  }

  panel.addEventListener("change", async (e) => {
    const { key, field } = e.target.dataset;
    if (!key || !field) return;

    categories[key][field] = e.target.value;
    const style = categories[key];

    await saveCategoryStyle(key, { label: style.label, color: style.color, shape: style.shape });
    registerCategoryIcons(map, categories);
    await refreshPoints(map);
  });
}
