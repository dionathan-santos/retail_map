import { SHAPES } from "../styles/categories.js";
import { saveCategoryStyle, fetchIcons } from "../api.js";
import { registerCategoryIcons, refreshPoints } from "../map.js";

// Lets users override icon/color per category without touching code, or
// assign a custom uploaded icon (from the Icon Bank panel) instead of a
// drawn shape. Persists to D1 (worker/index.js's /api/category-styles) and
// re-registers the MapLibre sprite images immediately so both the live map
// and any export pick up the change.
export async function renderCategoryStylePicker(map, categories) {
  const panel = document.getElementById("category-style-panel");
  const icons = await fetchIcons();

  panel.innerHTML = "<h3>Category Icons</h3>";

  for (const [key, style] of Object.entries(categories)) {
    const row = document.createElement("div");
    row.className = "category-style-row";
    row.innerHTML = `
      <span>${style.label}</span>
      <input type="color" value="${style.color}" data-key="${key}" data-field="color" ${style.iconId ? "disabled" : ""} />
      <select data-key="${key}" data-field="shape" ${style.iconId ? "disabled" : ""}>
        ${SHAPES.map((s) => `<option value="${s}" ${s === style.shape ? "selected" : ""}>${s}</option>`).join("")}
      </select>
      <select data-key="${key}" data-field="iconId">
        <option value="">Shape</option>
        ${icons.map((icon) => `<option value="${icon.id}" ${String(style.iconId) === String(icon.id) ? "selected" : ""}>${icon.name}</option>`).join("")}
      </select>
      <input type="range" min="0.2" max="2" step="0.1" value="${style.size ?? 0.6}" data-key="${key}" data-field="size" title="Icon size" />
    `;
    panel.appendChild(row);
  }

  if (panel.dataset.bound) return;
  panel.dataset.bound = "true";

  panel.addEventListener("change", async (e) => {
    const { key, field } = e.target.dataset;
    if (!key || !field) return;

    if (field === "iconId") {
      const iconId = e.target.value || null;
      categories[key].iconId = iconId;
      categories[key].iconImage = iconId ? icons.find((icon) => String(icon.id) === iconId)?.image_data : null;
    } else if (field === "size") {
      categories[key].size = Number(e.target.value);
    } else {
      categories[key][field] = e.target.value;
    }

    const style = categories[key];
    await saveCategoryStyle(key, {
      label: style.label,
      color: style.color,
      shape: style.shape,
      iconId: style.iconId || null,
      size: style.size,
    });

    if (field !== "size") {
      await registerCategoryIcons(map, categories);
    }
    await refreshPoints(map);

    if (field === "iconId") {
      await renderCategoryStylePicker(map, categories);
    }
  });
}
