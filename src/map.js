import maplibregl from "maplibre-gl";
import { CATEGORIES, categoryColor, ZONE_TIER_STYLE } from "./styles/categories.js";
import { AY_COLORS } from "./styles/brand-colors.js";

// OpenFreeMap's hosted "positron" style — free, unlimited, no API key,
// no signup. Used as a stand-in until the Edmonton-only .pmtiles extract
// is built and uploaded to our own Cloudflare R2 bucket (see
// .github/workflows/build-pmtiles.yml + README "Building the basemap
// PMTiles file"), at which point swap this back to a self-hosted
// pmtiles:// source styled with @protomaps/basemaps' GRAYSCALE theme.
const BASEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

const EDMONTON_CENTER = [-113.4909, 53.5461];

export function initMap() {
  const map = new maplibregl.Map({
    container: "map",
    style: BASEMAP_STYLE_URL,
    center: EDMONTON_CENTER,
    zoom: 11,
    minZoom: 8,
    maxZoom: 18,
    preserveDrawingBuffer: true, // required for canvas export
  });

  map.addControl(new maplibregl.NavigationControl(), "top-right");

  map.on("load", () => {
    addResidentialAreasLayer(map);
    addEmploymentAreasLayer(map);
    addRetailZonesLayer(map);
    addAspPolygonsLayer(map);
    addLrtLayer(map);
    addTrafficLayer(map);
    addEnclosedMallsLayer(map);
    addPoiLayer(map);
  });

  return map;
}

function addResidentialAreasLayer(map) {
  map.addSource("residential-areas", { type: "geojson", data: "/data/residential-areas.geojson" });

  map.addLayer({
    id: "residential-areas-fill",
    type: "fill",
    source: "residential-areas",
    paint: { "fill-color": "#c8c9c4", "fill-opacity": 0.25 },
  });

  map.on("click", "residential-areas-fill", (e) => {
    const { area_name } = e.features[0].properties;
    new maplibregl.Popup().setLngLat(e.lngLat).setHTML(`<h4>${area_name}</h4><p>Residential area</p>`).addTo(map);
  });
}

function addEmploymentAreasLayer(map) {
  map.addSource("employment-areas", { type: "geojson", data: "/data/employment-areas.geojson" });

  map.addLayer({
    id: "employment-areas-fill",
    type: "fill",
    source: "employment-areas",
    paint: { "fill-color": "#7d7370", "fill-opacity": 0.3 },
  });

  map.on("click", "employment-areas-fill", (e) => {
    const { area_name } = e.features[0].properties;
    new maplibregl.Popup().setLngLat(e.lngLat).setHTML(`<h4>${area_name}</h4><p>Employment area</p>`).addTo(map);
  });
}

function addLrtLayer(map) {
  map.addSource("lrt-lines", { type: "geojson", data: "/data/lrt-lines.geojson" });

  // line-dasharray can't be a data-driven (["get", ...]) expression in
  // MapLibre — it only accepts static or zoom expressions — so current vs.
  // future needs two filtered layers instead of one with a "match" dasharray.
  map.addLayer({
    id: "lrt-line-current",
    type: "line",
    source: "lrt-lines",
    filter: ["==", ["get", "status"], "current"],
    layout: { "line-cap": "round" },
    paint: { "line-color": "#4db595", "line-width": 2.5 },
  });

  map.addLayer({
    id: "lrt-line-future",
    type: "line",
    source: "lrt-lines",
    filter: ["==", ["get", "status"], "future"],
    layout: { "line-cap": "round" },
    paint: { "line-color": "#4db595", "line-width": 2.5, "line-dasharray": [2, 2] },
  });

  map.on("click", ["lrt-line-current", "lrt-line-future"], (e) => {
    const { line_name, status } = e.features[0].properties;
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`<h4>${line_name}</h4><p>LRT — ${status === "future" ? "future" : "current"}</p>`)
      .addTo(map);
  });
}

function addRetailZonesLayer(map) {
  map.addSource("retail-zones", { type: "geojson", data: "/data/retail-zones.geojson" });

  map.addLayer({
    id: "retail-zones-fill",
    type: "fill",
    source: "retail-zones",
    paint: { "fill-color": ZONE_TIER_STYLE.major.color, "fill-opacity": 0.05 },
  });

  // Split by tier (rather than one layer with a data-driven dasharray)
  // because line-dasharray can't be a ["get", ...] expression in MapLibre.
  map.addLayer({
    id: "retail-zones-line-major",
    type: "line",
    source: "retail-zones",
    filter: ["==", ["get", "tier"], "major"],
    paint: { "line-color": ZONE_TIER_STYLE.major.color, "line-width": ZONE_TIER_STYLE.major.width },
  });

  map.addLayer({
    id: "retail-zones-line-secondary",
    type: "line",
    source: "retail-zones",
    filter: ["==", ["get", "tier"], "secondary"],
    paint: {
      "line-color": ZONE_TIER_STYLE.secondary.color,
      "line-width": ZONE_TIER_STYLE.secondary.width,
      "line-dasharray": ZONE_TIER_STYLE.secondary.dash,
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
        0, AY_COLORS.champagne,
        20000, AY_COLORS.periwinkle,
        40000, AY_COLORS.midnight,
      ],
      "fill-opacity": 0.35,
    },
  });

  map.addLayer({
    id: "asp-polygons-line",
    type: "line",
    source: "asp-polygons",
    paint: { "line-color": AY_COLORS.midnight, "line-width": 1, "line-opacity": 0.6 },
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
      "text-color": AY_COLORS.orange,
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
      "circle-color": AY_COLORS.orange,
      "circle-stroke-color": "#FFFFFF",
      "circle-stroke-width": 1,
    },
  });
}

function addEnclosedMallsLayer(map) {
  map.addSource("enclosed-malls", { type: "geojson", data: "/data/enclosed-malls.geojson" });

  map.addLayer({
    id: "enclosed-malls-circle",
    type: "circle",
    source: "enclosed-malls",
    paint: {
      "circle-radius": 10,
      "circle-color": AY_COLORS.midnight,
      "circle-stroke-color": "#FFFFFF",
      "circle-stroke-width": 2,
    },
  });

  map.addLayer({
    id: "enclosed-malls-label",
    type: "symbol",
    source: "enclosed-malls",
    layout: {
      "text-field": ["to-string", ["get", "number"]],
      "text-size": 11,
      "text-font": ["Noto Sans Bold"],
    },
    paint: { "text-color": "#FFFFFF" },
  });

  map.on("click", "enclosed-malls-circle", (e) => {
    const { number, name, gla_sqft } = e.features[0].properties;
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`<h4>${number}. ${name}</h4><p>GLA: ${Number(gla_sqft).toLocaleString()} sf</p>`)
      .addTo(map);
  });

  map.on("mouseenter", "enclosed-malls-circle", () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", "enclosed-malls-circle", () => (map.getCanvas().style.cursor = ""));
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
  "toggle-zones": ["retail-zones-fill", "retail-zones-line-major", "retail-zones-line-secondary"],
  "toggle-asp": ["asp-polygons-fill", "asp-polygons-line"],
  "toggle-traffic": ["traffic-labels", "traffic-points"],
  "toggle-residential": ["residential-areas-fill"],
  "toggle-employment": ["employment-areas-fill"],
  "toggle-lrt": ["lrt-line-current", "lrt-line-future"],
  "toggle-malls": ["enclosed-malls-circle", "enclosed-malls-label"],
};

export function setLayerVisibility(map, layerIds, visible) {
  for (const id of layerIds) {
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}
