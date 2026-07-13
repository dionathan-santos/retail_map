import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import { AY_COLORS } from "../styles/brand-colors.js";

// Persisted to Cloudflare D1 via functions/api/features/[layerKey].js, with
// localStorage as a local cache/fallback — useful offline, and during local
// `vite dev` since Pages Functions only run under `wrangler pages dev`.
const STORAGE_KEY_PREFIX = "retail-map:draw:";

// Per-layer prompts for the attributes each polygon needs, matching the
// schema already used in data/retail-zones.geojson and data/asp-polygons.geojson.
const ATTRIBUTE_PROMPTS = {
  "retail-zones": [
    { key: "zone_name", label: "Zone name", type: "string" },
    { key: "tier", label: "Type (major or secondary)", type: "string", default: "secondary" },
  ],
  "asp-polygons": [
    { key: "asp_name", label: "ASP name", type: "string" },
    { key: "population", label: "Population", type: "number" },
    { key: "households", label: "Households", type: "number" },
    { key: "avg_household_income", label: "Average household income", type: "number" },
  ],
};

// Default shape style per layer, used until a feature carries its own
// style_* properties (set via the "Shape Style" panel in draw-toolbar.js).
const DEFAULT_STYLE = {
  "retail-zones": { fillColor: AY_COLORS.amethyst, fillOpacity: 0.15, lineColor: AY_COLORS.amethyst, lineWidth: 3 },
  "asp-polygons": { fillColor: AY_COLORS.periwinkle, fillOpacity: 0.35, lineColor: AY_COLORS.midnight, lineWidth: 1 },
};

function defaultStyleFor(layerKey) {
  return DEFAULT_STYLE[layerKey] || DEFAULT_STYLE["retail-zones"];
}

// Reads per-feature style_* properties with a fallback to the active
// layer's default — shared by both the polygon (drawing) and select
// (editing) mode styling functions so a shape looks the same in both.
function styleReader(getActiveLayerKey, styleKey, defaultKey) {
  return (feature) => {
    const value = feature.properties?.[styleKey];
    if (value !== undefined && value !== null && value !== "") return value;
    return defaultStyleFor(getActiveLayerKey())[defaultKey];
  };
}

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
  let activeLayerKey = null;
  const getActiveLayerKey = () => activeLayerKey;

  const fillColor = styleReader(getActiveLayerKey, "style_fill_color", "fillColor");
  const fillOpacity = styleReader(getActiveLayerKey, "style_fill_opacity", "fillOpacity");
  const lineColor = styleReader(getActiveLayerKey, "style_line_color", "lineColor");
  const lineWidth = styleReader(getActiveLayerKey, "style_line_width", "lineWidth");

  const draw = new TerraDraw({
    adapter: new TerraDrawMapLibreGLAdapter({ map }),
    modes: [
      // Governs idle ("static") rendering of committed polygons — this is
      // what a shape looks like most of the time, selected or not.
      new TerraDrawPolygonMode({
        styles: { fillColor, fillOpacity, outlineColor: lineColor, outlineWidth: lineWidth },
      }),
      // Governs the appearance of the one feature currently selected for
      // editing — mapped to the same style_* properties so it doesn't
      // flash to a different look on select.
      new TerraDrawSelectMode({
        flags: {
          polygon: { feature: { draggable: true, coordinates: { midpoints: true, draggable: true, deletable: true } } },
        },
        styles: {
          selectedPolygonColor: fillColor,
          selectedPolygonFillOpacity: fillOpacity,
          selectedPolygonOutlineColor: lineColor,
          selectedPolygonOutlineWidth: lineWidth,
        },
      }),
    ],
  });

  draw.start();
  draw.setMode("static");

  let selectedFeatureId = null;
  let selectionListeners = [];

  function notifySelectionChange() {
    const feature = selectedFeatureId
      ? draw.getSnapshot().find((f) => f.id === selectedFeatureId) || null
      : null;
    for (const listener of selectionListeners) listener(feature);
  }

  draw.on("select", (id) => {
    selectedFeatureId = id;
    notifySelectionChange();
  });

  draw.on("deselect", () => {
    selectedFeatureId = null;
    notifySelectionChange();
  });

  function persistActiveLayer() {
    if (!activeLayerKey) return;
    saveFeatures(activeLayerKey, draw.getSnapshot());
  }

  draw.on("finish", (id) => {
    draw.updateFeatureProperties(id, promptForAttributes(activeLayerKey));
    persistActiveLayer();
    draw.setMode("static");
  });

  draw.on("change", () => {
    persistActiveLayer();
    notifySelectionChange();
  });

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
    onSelectionChange: (listener) => selectionListeners.push(listener),
    getDefaultStyle: () => defaultStyleFor(activeLayerKey),
    updateSelectedStyle: (styleProps) => {
      if (!selectedFeatureId) return;
      draw.updateFeatureProperties(selectedFeatureId, styleProps);
      persistActiveLayer();
      notifySelectionChange();
    },
    resetSelectedStyle: () => {
      if (!selectedFeatureId) return;
      draw.updateFeatureProperties(selectedFeatureId, {
        style_fill_color: "",
        style_fill_opacity: "",
        style_line_color: "",
        style_line_width: "",
      });
      persistActiveLayer();
      notifySelectionChange();
    },
  };
}
