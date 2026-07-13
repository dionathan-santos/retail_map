import { fetchIcons, createIcon, deleteIcon } from "../api.js";
import { renderCategoryStylePicker } from "./category-style-picker.js";

// Upload PNG icons once here, then assign them to categories in the
// "Category Icons" panel (replacing the drawn shape/color for that
// category). Icons are stored inline in D1 as base64 -- no R2 bucket
// needed for the sizes involved here.
export async function renderIconBank(map, categories) {
  const panel = document.getElementById("icon-bank-panel");
  await refresh(panel, map, categories);
}

async function refresh(panel, map, categories) {
  const icons = await fetchIcons();

  panel.innerHTML = `
    <h3>Icon Bank</h3>
    <input type="file" id="icon-upload" accept="image/png" />
    <div id="icon-bank-list"></div>
    <p id="icon-bank-status"></p>
  `;

  const list = panel.querySelector("#icon-bank-list");
  for (const icon of icons) {
    const row = document.createElement("div");
    row.className = "icon-bank-row";
    row.innerHTML = `
      <img src="data:image/png;base64,${icon.image_data}" alt="${icon.name}" />
      <span>${icon.name}</span>
      <button type="button" data-id="${icon.id}">Delete</button>
    `;
    list.appendChild(row);
  }

  const fileInput = panel.querySelector("#icon-upload");
  const status = panel.querySelector("#icon-bank-status");

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);
      const name = file.name.replace(/\.png$/i, "");
      await createIcon(name, base64);
      await refresh(panel, map, categories);
      await renderCategoryStylePicker(map, categories);
    } catch (err) {
      status.textContent = `Error: ${err.message}`;
    } finally {
      fileInput.value = "";
    }
  });

  list.querySelectorAll("button[data-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await deleteIcon(button.dataset.id);
      await refresh(panel, map, categories);
      await renderCategoryStylePicker(map, categories);
    });
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
