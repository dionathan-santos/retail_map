import maplibregl from "maplibre-gl";
import basemapConfig from "./basemap-config.json";
import { mergeCategories, categoryStyle, drawIcon } from "./styles/categories.js";
import { fetchCategoryStyles, fetchPoints } from "./api.js";

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
  });

  map.addControl(new maplibregl.NavigationControl(), "top-right");

  map.on("load", async () => {
    registerCategoryIcons(map, categories);
    await addPointsLayer(map, categories);
  });

  map.categories = categories;
  return map;
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

// Draws one sprite image per category color/shape combo and registers it
// with MapLibre under `icon-<category>`, so the same registered image is
// used both in the live map and in the exported canvas snapshot.
export function registerCategoryIcons(map, categories) {
  for (const [key, style] of Object.entries(categories)) {
    const imageId = `icon-${key}`;
    if (map.hasImage(imageId)) map.removeImage(imageId);
    map.addImage(imageId, drawIcon(style.shape, style.color), { pixelRatio: 2 });
  }
}

export async function addPointsLayer(map, categories) {
  const points = await fetchPoints();
  const geojson = pointsToGeoJson(points);

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
      "icon-image": ["concat", "icon-", ["get", "category"]],
      "icon-size": 0.6,
      "icon-allow-overlap": true,
    },
    paint: {
      "icon-opacity": ["match", ["get", "status"], "closed", 0.35, 1],
    },
  });

  map.on("click", "retail-points-symbol", (e) => {
    const p = e.features[0].properties;
    const style = categoryStyle(categories, p.category);
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(
        `<h4>${p.name}</h4>` +
        `<p>${style.label}${p.status === "closed" ? " — CLOSED" : ""}<br>` +
        `${p.address || ""}<br>` +
        `<small>${p.last_updated || ""} · ${p.source || ""}</small></p>`
      )
      .addTo(map);
  });

  map.on("mouseenter", "retail-points-symbol", () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", "retail-points-symbol", () => (map.getCanvas().style.cursor = ""));
}

function pointsToGeoJson(points) {
  return {
    type: "FeatureCollection",
    features: points.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: p,
    })),
  };
}

export async function refreshPoints(map) {
  await addPointsLayer(map, map.categories);
}

export const TOGGLEABLE_LAYERS = {
  "toggle-points": ["retail-points-symbol"],
};

export function setLayerVisibility(map, layerIds, visible) {
  for (const id of layerIds) {
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}
