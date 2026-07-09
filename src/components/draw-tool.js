import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";

// Local-only persistence for now (see README "Digitizing zones & ASP
// polygons in-app"): drawn shapes are kept in localStorage per layer, plus
// an "Export GeoJSON" button so they can be committed to /data once a
// backend (Firestore or a Cloudflare Worker/D1) is wired up later.
const STORAGE_KEY_PREFIX = "retail-map:draw:";

// Per-layer prompts for the attributes each polygon needs, matching the
// schema already used in data/retail-zones.geojson and data/asp-polygons.geojson.
const ATTRIBUTE_PROMPTS = {
  "retail-zones": [
    { key: "zone_name", label: "Nome da zona", type: "string" },
    { key: "tier", label: "Tipo (major ou secondary)", type: "string", default: "secondary" },
  ],
  "asp-polygons": [
    { key: "asp_name", label: "Nome do ASP", type: "string" },
    { key: "population", label: "População", type: "number" },
    { key: "households", label: "Domicílios", type: "number" },
    { key: "avg_household_income", label: "Renda média domiciliar", type: "number" },
  ],
};

function storageKey(layerKey) {
  return `${STORAGE_KEY_PREFIX}${layerKey}`;
}

function loadFeatures(layerKey) {
  const raw = localStorage.getItem(storageKey(layerKey));
  if (!raw) return [];
  try {
    return JSON.parse(raw).features || [];
  } catch {
    return [];
  }
}

function saveFeatures(layerKey, features) {
  localStorage.setItem(storageKey(layerKey), JSON.stringify({ type: "FeatureCollection", features }));
}

function promptForAttributes(layerKey) {
  const fields = ATTRIBUTE_PROMPTS[layerKey] || [];
  const properties = {};
  for (const field of fields) {
    const raw = window.prompt(field.label, field.default ?? "");
    properties[field.key] = field.type === "number" ? Number(raw) || 0 : raw || "";
  }
  return properties;
}

function downloadGeoJson(layerKey, features) {
  const geojson = { type: "FeatureCollection", features };
  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/geo+json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${layerKey}.geojson`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * A single TerraDraw instance shared across drawable layers (zones, ASP
 * polygons). Only one instance runs against the map at a time — switching
 * the active layer saves the current shapes to that layer's localStorage
 * slot, clears the canvas, and loads the other layer's saved shapes.
 */
export function createDrawTool(map) {
  const draw = new TerraDraw({
    adapter: new TerraDrawMapLibreGLAdapter({ map }),
    modes: [
      new TerraDrawPolygonMode(),
      new TerraDrawSelectMode({
        flags: {
          polygon: { feature: { draggable: true, coordinates: { midpoints: true, draggable: true, deletable: true } } },
        },
      }),
    ],
  });

  draw.start();
  draw.setMode("static");

  let activeLayerKey = null;

  function persistActiveLayer() {
    if (!activeLayerKey) return;
    saveFeatures(activeLayerKey, draw.getSnapshot());
  }

  draw.on("finish", (id) => {
    draw.updateFeatureProperties(id, promptForAttributes(activeLayerKey));
    persistActiveLayer();
    draw.setMode("static");
  });

  draw.on("change", persistActiveLayer);

  function setActiveLayer(layerKey) {
    if (layerKey === activeLayerKey) return;
    persistActiveLayer();
    draw.clear();
    activeLayerKey = layerKey;
    const features = loadFeatures(layerKey);
    if (features.length) draw.addFeatures(features);
    draw.setMode("static");
  }

  return {
    setActiveLayer,
    startDrawing: () => draw.setMode("polygon"),
    startEditing: () => draw.setMode("select"),
    stopDrawing: () => draw.setMode("static"),
    clear: () => {
      draw.clear();
      if (activeLayerKey) localStorage.removeItem(storageKey(activeLayerKey));
    },
    exportGeoJson: () => downloadGeoJson(activeLayerKey, draw.getSnapshot()),
  };
}
