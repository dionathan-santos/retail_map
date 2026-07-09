import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import { CATEGORIES, categoryColor, ZONE_TIER_STYLE } from "./styles/categories.js";

// Placeholder — swap for the real Cloudflare R2 bucket URL once provisioned.
// e.g. "https://retail-map-tiles.<account>.r2.dev/edmonton.pmtiles"
const PROTOMAPS_URL = "pmtiles://https://placeholder-r2-bucket.example.com/edmonton.pmtiles";

const EDMONTON_CENTER = [-113.4909, 53.5461];

export function initMap() {
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);

  const map = new maplibregl.Map({
    container: "map",
    style: buildStyle(),
    center: EDMONTON_CENTER,
    zoom: 11,
    minZoom: 8,
    maxZoom: 18,
    preserveDrawingBuffer: true, // required for canvas export
  });

  map.addControl(new maplibregl.NavigationControl(), "top-right");

  map.on("load", () => {
    addRetailZonesLayer(map);
    addAspPolygonsLayer(map);
    addTrafficLayer(map);
    addPoiLayer(map);
  });

  return map;
}

function buildStyle() {
  return {
    version: 8,
    glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    sources: {
      protomaps: {
        type: "vector",
        url: PROTOMAPS_URL,
        attribution: "&copy; Protomaps &copy; OpenStreetMap contributors",
      },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#F2F0EA" } },
      // Real basemap layers are generated from the Protomaps theme once the
      // bucket is live; left minimal here since data layers are the focus of v1.
    ],
  };
}

function addRetailZonesLayer(map) {
  map.addSource("retail-zones", { type: "geojson", data: "/data/retail-zones.geojson" });

  map.addLayer({
    id: "retail-zones-fill",
    type: "fill",
    source: "retail-zones",
    paint: { "fill-color": ZONE_TIER_STYLE.major.color, "fill-opacity": 0.05 },
  });

  map.addLayer({
    id: "retail-zones-line",
    type: "line",
    source: "retail-zones",
    paint: {
      "line-color": ZONE_TIER_STYLE.major.color,
      "line-width": ["match", ["get", "tier"], "major", ZONE_TIER_STYLE.major.width, ZONE_TIER_STYLE.secondary.width],
      "line-dasharray": ["match", ["get", "tier"], "secondary", ["literal", ZONE_TIER_STYLE.secondary.dash], ["literal", [1, 0]]],
    },
  });

  map.on("click", "retail-zones-fill", (e) => {
    const { zone_name, tier } = e.features[0].properties;
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`<h4>${zone_name}</h4><p>${tier === "major" ? "Major" : "Secondary"} retail zone</p>`)
      .addTo(map);
  });
}

function addAspPolygonsLayer(map) {
  map.addSource("asp-polygons", { type: "geojson", data: "/data/asp-polygons.geojson" });

  map.addLayer({
    id: "asp-polygons-fill",
    type: "fill",
    source: "asp-polygons",
    paint: {
      "fill-color": [
        "interpolate", ["linear"], ["get", "population"],
        0, "#EAF1F8",
        20000, "#7FA8CE",
        40000, "#1F4E79",
      ],
      "fill-opacity": 0.35,
    },
  });

  map.addLayer({
    id: "asp-polygons-line",
    type: "line",
    source: "asp-polygons",
    paint: { "line-color": "#1F4E79", "line-width": 1, "line-opacity": 0.6 },
  });

  map.on("click", "asp-polygons-fill", (e) => {
    const p = e.features[0].properties;
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(
        `<h4>${p.asp_name}</h4>` +
        `<p>Population: ${Number(p.population).toLocaleString()}<br>` +
        `Households: ${Number(p.households).toLocaleString()}<br>` +
        `Avg. HH income: $${Number(p.avg_household_income).toLocaleString()}</p>`
      )
      .addTo(map);
  });
}

function addTrafficLayer(map) {
  map.addSource("traffic-counts", { type: "geojson", data: "/data/traffic-counts.geojson" });

  map.addLayer({
    id: "traffic-labels",
    type: "symbol",
    source: "traffic-counts",
    layout: {
      "text-field": ["concat", ["number-format", ["get", "aadt"], {}], " AADT"],
      "text-size": 11,
      "text-font": ["Noto Sans Bold"],
      "text-offset": [0, 1.2],
      "text-anchor": "top",
    },
    paint: {
      "text-color": "#7A1F1F",
      "text-halo-color": "#FFFFFF",
      "text-halo-width": 1.5,
    },
  });

  map.addLayer({
    id: "traffic-points",
    type: "circle",
    source: "traffic-counts",
    paint: {
      "circle-radius": 4,
      "circle-color": "#7A1F1F",
      "circle-stroke-color": "#FFFFFF",
      "circle-stroke-width": 1,
    },
  });
}

function addPoiLayer(map) {
  map.addSource("retail-pois", { type: "geojson", data: "/data/retail-pois.geojson" });

  map.addLayer({
    id: "retail-pois-circle",
    type: "circle",
    source: "retail-pois",
    paint: {
      "circle-radius": 7,
      "circle-color": [
        "match", ["get", "category"],
        ...Object.entries(CATEGORIES).flatMap(([key, { color }]) => [key, color]),
        CATEGORIES.other.color,
      ],
      "circle-stroke-color": "#FFFFFF",
      "circle-stroke-width": 2,
      "circle-opacity": ["match", ["get", "status"], "closed", 0.35, 1],
    },
  });

  map.on("click", "retail-pois-circle", (e) => {
    const p = e.features[0].properties;
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(
        `<h4>${p.name}</h4>` +
        `<p>${CATEGORIES[p.category]?.label || "Other"}${p.status === "closed" ? " — CLOSED" : ""}<br>` +
        `${p.address}<br>` +
        `<small>Updated ${p.last_updated} · ${p.source}</small></p>`
      )
      .addTo(map);
  });

  map.on("mouseenter", "retail-pois-circle", () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", "retail-pois-circle", () => (map.getCanvas().style.cursor = ""));
}

// Mirrors the CM Land Tracker layer-toggle pattern: each entry maps a
// checkbox id to the MapLibre layer ids it controls.
export const TOGGLEABLE_LAYERS = {
  "toggle-pois": ["retail-pois-circle"],
  "toggle-zones": ["retail-zones-fill", "retail-zones-line"],
  "toggle-asp": ["asp-polygons-fill", "asp-polygons-line"],
  "toggle-traffic": ["traffic-labels", "traffic-points"],
};

export function setLayerVisibility(map, layerIds, visible) {
  for (const id of layerIds) {
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}
