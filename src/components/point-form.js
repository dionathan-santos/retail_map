import { createPoint } from "../api.js";
import { refreshPoints } from "../map.js";

// Single-point-add: click-to-place on the map, or type lat/lng directly.
// Writes through the same /api/points endpoint the bulk upload uses.
export function renderPointForm(map, categories) {
  const panel = document.getElementById("point-form-panel");
  panel.innerHTML = `
    <h3>Add Point</h3>
    <button id="pick-on-map" type="button">Pick location on map</button>
    <form id="point-form">
      <label>Name <input name="name" required /></label>
      <label>Category
        <select name="category">
          ${Object.entries(categories).map(([key, c]) => `<option value="${key}">${c.label}</option>`).join("")}
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
      <button type="submit">Save point</button>
    </form>
    <p id="point-form-status"></p>
  `;

  const form = panel.querySelector("#point-form");
  const status = panel.querySelector("#point-form-status");
  const latInput = form.elements.lat;
  const lngInput = form.elements.lng;

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
    data.lat = Number(data.lat);
    data.lng = Number(data.lng);
    data.last_updated = new Date().toISOString().slice(0, 10);

    try {
      await createPoint(data);
      await refreshPoints(map);
      status.textContent = `Saved "${data.name}".`;
      form.reset();
    } catch (err) {
      status.textContent = `Error: ${err.message}`;
    }
  });
}
