import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";

// Persisted to Cloudflare D1 via functions/api/features/[layerKey].js, with
// localStorage as a local cache/fallback — useful offline, and during local
// `vite dev` since Pages Functions only run under `wrangler pages dev`.
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

function loadFromLocalCache(layerKey) {
  const raw = localStorage.getItem(storageKey(layerKey));
  if (!raw) return [];
  try {
    return JSON.parse(raw).features || [];
  } catch {
    return [];
  }
}

function writeLocalCache(layerKey, features) {
  localStorage.setItem(storageKey(layerKey), JSON.stringify({ features }));
}

async function loadFeatures(layerKey) {
  try {
    const res = await fetch(`/api/features/${layerKey}`);
    if (res.ok) {
      const { features } = await res.json();
      writeLocalCache(layerKey, features);
      return features;
    }
  } catch {
    // offline, or local dev server without Pages Functions — use the cache
  }
  return loadFromLocalCache(layerKey);
}

function saveFeatures(layerKey, features) {
  writeLocalCache(layerKey, features);
  fetch(`/api/features/${layerKey}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ features }),
  }).catch(() => {
    // D1 sync failed silently — the local cache still has the latest
    // snapshot and the next successful save will resync it in full.
  });
}

function clearFeatures(layerKey) {
  localStorage.removeItem(storageKey(layerKey));
  fetch(`/api/features/${layerKey}`, { method: "DELETE" }).catch(() => {});
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
 * the active layer saves the current shapes for that layer, clears the
 * canvas, and loads the other layer's saved shapes.
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

  async function setActiveLayer(layerKey) {
    if (layerKey === activeLayerKey) return;
    persistActiveLayer();
    draw.clear();
    activeLayerKey = layerKey;
    const features = await loadFeatures(layerKey);
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
      if (activeLayerKey) clearFeatures(activeLayerKey);
    },
    exportGeoJson: () => downloadGeoJson(activeLayerKey, draw.getSnapshot()),
  };
}
