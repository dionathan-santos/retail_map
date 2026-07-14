import maplibregl from "maplibre-gl";
import basemapConfig from "./basemap-config.json";
import { mergeCategories, categoryStyle, drawIcon, DEFAULT_ICON_SIZE } from "./styles/categories.js";
import { fetchCategoryStyles, fetchPoints, deletePoint } from "./api.js";

export async function initMap() {
  const overrides = await fetchCategoryStyles();
  const categories = mergeCategories(overrides);

  const map = new maplibregl.Map({
    container: "map",
    style: buildStyle(),
    center: centerOf(basemapConfig.coordinates),
    zoom: 11,
    minZoom: 8,
    maxZoom: 19,
    preserveDrawingBuffer: true, // required for canvas export
    // MapLibre's default is a conservative 4096x4096 -- well under the
    // print-resolution canvas src/export.js temporarily grows to (up to
    // ~7000x5000 for A0 at 150 DPI), which silently downscaled the export
    // and left blank margins around it. Ask the actual GPU what it
    // supports instead of hardcoding a number.
    maxCanvasSize: getSafeMaxCanvasSize(),
  });

  map.addControl(new maplibregl.NavigationControl(), "top-right");

  map.on("load", async () => {
    await registerCategoryIcons(map, categories);
    await addPointsLayer(map, categories);
    addProjectPointsLayer(map);
  });

  map.categories = categories;
  return map;
}

function getSafeMaxCanvasSize() {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  const maxSize = gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 4096;
  return [maxSize, maxSize];
}

function centerOf(coordinates) {
  const lngs = coordinates.map((c) => c[0]);
  const lats = coordinates.map((c) => c[1]);
  return [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
}

function buildStyle() {
  return {
    version: 8,
    // No `glyphs` URL on purpose: point names render in the click popup
    // (plain HTML), not as map text-field labels. That keeps icon
    // rendering fully independent of an external font/glyph CDN, which
    // the spec flags as a real risk ("check icon rendering works for both
    // paths early, since this tripped up equivalent projects before") --
    // a slow/unreachable glyph server can otherwise stall symbol-layer
    // rendering for the whole source, icons included.
    sources: {
      basemap: {
        type: "image",
        url: basemapConfig.url,
        coordinates: basemapConfig.coordinates,
      },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#F2F0EA" } },
      { id: "basemap", type: "raster", source: "basemap" },
    ],
  };
}

// Registers one sprite image per category under `icon-<category>`, so the
// same registered image is used both in the live map and in the exported
// canvas snapshot. Categories with a custom uploaded icon (style.iconImage,
// a base64 PNG from the icon bank) use that directly; otherwise a shape is
// drawn to a canvas as before.
export async function registerCategoryIcons(map, categories) {
  for (const [key, style] of Object.entries(categories)) {
    const imageId = `icon-${key}`;
    if (map.hasImage(imageId)) map.removeImage(imageId);

    if (style.iconImage) {
      const img = await loadImage(`data:image/png;base64,${style.iconImage}`);
      map.addImage(imageId, img);
    } else {
      map.addImage(imageId, drawIcon(style.shape, style.color), { pixelRatio: 2 });
    }
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load icon image`));
    img.src = src;
  });
}

export async function addPointsLayer(map, categories) {
  const points = await fetchPoints();
  await registerPointIcons(map, points);
  const geojson = pointsToGeoJson(points, categories);

  if (map.getSource("retail-points")) {
    map.getSource("retail-points").setData(geojson);
    return;
  }

  map.addSource("retail-points", { type: "geojson", data: geojson });

  map.addLayer({
    id: "retail-points-symbol",
    type: "symbol",
    source: "retail-points",
    layout: {
      "icon-image": ["get", "iconImageId"],
      "icon-size": ["get", "iconSize"],
      "icon-allow-overlap": true,
    },
    paint: {
      "icon-opacity": ["match", ["get", "status"], "closed", 0.35, 1],
    },
  });

  map.on("click", "retail-points-symbol", (e) => {
    const p = e.features[0].properties;
    const style = categoryStyle(categories, p.category);
    const popup = new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(
        `<h4>${p.name}</h4>` +
        `<p>${style.label}${p.status === "closed" ? " — CLOSED" : ""}<br>` +
        `${p.address || ""}<br>` +
        `<small>${p.last_updated || ""} · ${p.source || ""}</small></p>` +
        `<div class="popup-actions">` +
        `<button class="popup-edit">Edit</button>` +
        `<button class="popup-delete">Delete</button>` +
        `</div>`
      )
      .addTo(map);

    const el = popup.getElement();
    el.querySelector(".popup-edit").addEventListener("click", () => {
      map.startEditingPoint(p);
      popup.remove();
    });
    el.querySelector(".popup-delete").addEventListener("click", async () => {
      if (!confirm(`Delete "${p.name}"?`)) return;
      await deletePoint(p.id);
      await refreshPoints(map);
      popup.remove();
    });
  });

  map.on("mouseenter", "retail-points-symbol", () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", "retail-points-symbol", () => (map.getCanvas().style.cursor = ""));
}

// Registers a sprite image for each distinct per-point custom icon
// (points.icon_id, joined server-side to points.icon_image) under
// `custom-icon-<id>`, so pointsToGeoJson's iconImageId can reference it
// directly instead of falling back to the point's category icon.
async function registerPointIcons(map, points) {
  const seen = new Set();
  for (const p of points) {
    if (!p.icon_id || !p.icon_image || seen.has(p.icon_id)) continue;
    seen.add(p.icon_id);

    const imageId = `custom-icon-${p.icon_id}`;
    if (map.hasImage(imageId)) continue;
    const img = await loadImage(`data:image/png;base64,${p.icon_image}`);
    map.addImage(imageId, img);
  }
}

function pointsToGeoJson(points, categories) {
  return {
    type: "FeatureCollection",
    features: points.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: {
        ...p,
        iconImageId: p.icon_id ? `custom-icon-${p.icon_id}` : `icon-${p.category}`,
        iconSize: p.icon_size ?? categoryStyle(categories, p.category).size ?? DEFAULT_ICON_SIZE,
      },
    })),
  };
}

export async function refreshPoints(map) {
  await addPointsLayer(map, map.categories);
}

// Project-specific annotation pins (src/projects-store.js), kept separate
// from the D1-backed retail-points layer above: these are per-project,
// client-only markers, not part of the shared retail points database.
// No text-field label here either, for the same glyph-CDN-independence
// reason as retail-points-symbol -- the label shows in the click popup.
function addProjectPointsLayer(map) {
  map.addSource("project-points", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  map.addLayer({
    id: "project-points-circle",
    type: "circle",
    source: "project-points",
    paint: {
      "circle-radius": 8,
      "circle-color": "#7A1F1F",
      "circle-stroke-color": "#FFFFFF",
      "circle-stroke-width": 2,
    },
  });

  map.on("click", "project-points-circle", (e) => {
    const p = e.features[0].properties;
    new maplibregl.Popup().setLngLat(e.lngLat).setHTML(`<h4>${p.label}</h4>`).addTo(map);
  });

  map.on("mouseenter", "project-points-circle", () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", "project-points-circle", () => (map.getCanvas().style.cursor = ""));
}

// Updates the project-points source from a project's saved points array
// (each point: { id, lng, lat, label }).
export function setProjectPoints(map, points) {
  const source = map.getSource("project-points");
  if (!source) return;

  source.setData({
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [point.lng, point.lat] },
      properties: { id: point.id, label: point.label },
    })),
  });
}

export const TOGGLEABLE_LAYERS = {
  "toggle-points": ["retail-points-symbol"],
};

export function setLayerVisibility(map, layerIds, visible) {
  for (const id of layerIds) {
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}
