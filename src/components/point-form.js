import { createPoint, updatePoint, fetchIcons } from "../api.js";
import { refreshPoints } from "../map.js";

// Single-point-add: click-to-place on the map, or type lat/lng directly.
// Also handles editing an existing point -- map.js's click popup calls
// map.startEditingPoint(point) (set below) to populate this same form in
// edit mode. Both paths write through the same /api/points endpoint(s) the
// bulk upload uses, so all three flows stay consistent.
export async function renderPointForm(map, categories) {
  const panel = document.getElementById("point-form-panel");
  const icons = await fetchIcons();

  panel.innerHTML = `
    <h3 id="point-form-heading">Add Point</h3>
    <button id="pick-on-map" type="button">Pick location on map</button>
    <form id="point-form">
      <input type="hidden" name="id" />
      <label>Name <input name="name" required /></label>
      <label>Category
        <select name="category">
          ${Object.entries(categories).map(([key, c]) => `<option value="${key}">${c.label}</option>`).join("")}
        </select>
      </label>
      <label>Icon
        <select name="iconId">
          <option value="">Category default</option>
          ${icons.map((icon) => `<option value="${icon.id}">${icon.name}</option>`).join("")}
        </select>
      </label>
      <label>Lat <input name="lat" type="number" step="any" required /></label>
      <label>Lng <input name="lng" type="number" step="any" required /></label>
      <label>Address <input name="address" /></label>
      <label>Status
        <select name="status">
          <option value="active">Active</option>
          <option value="closed">Closed</option>
        </select>
      </label>
      <label>Source <input name="source" /></label>
      <div class="point-form-buttons">
        <button type="submit" id="point-form-submit">Save point</button>
        <button type="button" id="point-form-cancel" hidden>Cancel edit</button>
      </div>
    </form>
    <p id="point-form-status"></p>
  `;

  const heading = panel.querySelector("#point-form-heading");
  const form = panel.querySelector("#point-form");
  const status = panel.querySelector("#point-form-status");
  const submitButton = panel.querySelector("#point-form-submit");
  const cancelButton = panel.querySelector("#point-form-cancel");
  const latInput = form.elements.lat;
  const lngInput = form.elements.lng;

  function resetToAddMode() {
    form.reset();
    form.elements.id.value = "";
    heading.textContent = "Add Point";
    submitButton.textContent = "Save point";
    cancelButton.hidden = true;
    status.textContent = "";
  }

  map.startEditingPoint = (point) => {
    form.elements.id.value = point.id;
    form.elements.name.value = point.name;
    form.elements.category.value = point.category;
    form.elements.iconId.value = point.icon_id || "";
    form.elements.lat.value = point.lat;
    form.elements.lng.value = point.lng;
    form.elements.address.value = point.address || "";
    form.elements.status.value = point.status || "active";
    form.elements.source.value = point.source || "";
    heading.textContent = `Edit "${point.name}"`;
    submitButton.textContent = "Update point";
    cancelButton.hidden = false;
    status.textContent = "";
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  cancelButton.addEventListener("click", resetToAddMode);

  let picking = false;
  const pickButton = panel.querySelector("#pick-on-map");
  pickButton.addEventListener("click", () => {
    picking = true;
    pickButton.textContent = "Click on the map...";
    map.getCanvas().style.cursor = "crosshair";
  });

  map.on("click", (e) => {
    if (!picking) return;
    latInput.value = e.lngLat.lat.toFixed(6);
    lngInput.value = e.lngLat.lng.toFixed(6);
    picking = false;
    pickButton.textContent = "Pick location on map";
    map.getCanvas().style.cursor = "";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const id = data.id;
    delete data.id;
    data.lat = Number(data.lat);
    data.lng = Number(data.lng);
    data.iconId = data.iconId || null;
    data.last_updated = new Date().toISOString().slice(0, 10);

    try {
      if (id) {
        await updatePoint(id, data);
      } else {
        await createPoint(data);
      }
      await refreshPoints(map);
      const message = id ? `Updated "${data.name}".` : `Saved "${data.name}".`;
      resetToAddMode();
      status.textContent = message;
    } catch (err) {
      status.textContent = `Error: ${err.message}`;
    }
  });
}
