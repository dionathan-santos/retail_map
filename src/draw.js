import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import { fetchShapes, createShape, updateShape, deleteShapeApi } from "./api.js";
import { getCurrentProjectId } from "./current-project.js";

const DEFAULT_STYLE = { color: "#5B3A9B", fillOpacity: 0.3 };

// Sets up drawable/editable polygon "shapes" (retail zones, trade areas,
// etc. -- freeform, unlike the fixed category points) on top of the map,
// persisted to the same D1 database via /api/shapes. Terra Draw owns the
// interactive geometry; this module just keeps its store in sync with the
// backend on create/update/delete.
export async function initDraw(map) {
  const draw = new TerraDraw({
    adapter: new TerraDrawMapLibreGLAdapter({ map }),
    modes: [
      new TerraDrawPolygonMode({
        styles: {
          fillColor: (feature) => feature.properties.color || DEFAULT_STYLE.color,
          fillOpacity: (feature) => feature.properties.fillOpacity ?? DEFAULT_STYLE.fillOpacity,
          outlineColor: (feature) => feature.properties.color || DEFAULT_STYLE.color,
          outlineWidth: 2,
        },
      }),
      new TerraDrawSelectMode({
        flags: {
          polygon: {
            feature: {
              draggable: true,
              coordinates: { midpoints: true, draggable: true, deletable: true },
            },
          },
        },
        styles: {
          selectedPolygonColor: (feature) => feature.properties.color || DEFAULT_STYLE.color,
          selectedPolygonFillOpacity: (feature) => feature.properties.fillOpacity ?? DEFAULT_STYLE.fillOpacity,
          selectedPolygonOutlineColor: (feature) => feature.properties.color || DEFAULT_STYLE.color,
          selectedPolygonOutlineWidth: 2,
        },
      }),
    ],
  });

  draw.currentStyle = { ...DEFAULT_STYLE };
  draw.start();
  draw.setMode("select");

  let selectedId = null;
  draw.on("select", (id) => (selectedId = id));
  draw.on("deselect", () => (selectedId = null));

  // Set while loadShapes() swaps the store's contents for another
  // project's/the base map's shapes -- clear()/addFeatures() still fire
  // "change" events, but those are just us re-syncing the local view, not
  // user edits, so they must not hit the API (that would delete/recreate
  // shapes that are already correctly persisted).
  let suppressSync = false;

  // Persist a newly drawn polygon only once it's actually finished, rather
  // than reacting to every "create" change event -- while a polygon is
  // being drawn, Terra Draw also emits "create"/"update" events for its own
  // internal helper features (a "closingPoint" guide point, a
  // "currentlyDrawing" placeholder with degenerate coordinates), and those
  // aren't real shapes to save.
  draw.on("finish", async (id, { action }) => {
    if (suppressSync || action !== "draw") return;
    draw.updateFeatureProperties(id, { ...draw.currentStyle, name: "" });
    const feature = draw.getSnapshotFeature(id);
    if (feature && feature.geometry.type === "Polygon") {
      await createShape(id, feature.geometry, feature.properties, getCurrentProjectId());
    }
  });

  // Edits to an already-persisted polygon (dragging its shape or a vertex
  // in select mode) come through here as "update" events; deletions
  // (including of the internal helper features mentioned above, which is
  // harmless -- deleting a shape id that was never persisted is a no-op)
  // come through as "delete". "create" is intentionally not handled here;
  // see the "finish" listener above.
  draw.on("change", async (ids, type) => {
    if (suppressSync) return;
    if (type === "update") {
      for (const id of ids) {
        const feature = draw.getSnapshotFeature(id);
        if (!feature || feature.geometry.type !== "Polygon" || feature.properties.currentlyDrawing) continue;
        await updateShape(id, feature.geometry, feature.properties);
      }
    } else if (type === "delete") {
      for (const id of ids) {
        await deleteShapeApi(id);
      }
    }
  });

  // Swaps the store's contents for the given project's shapes (or the base
  // map's, if projectId is omitted). Used both for the initial load and
  // whenever projects-panel.js switches the active project.
  async function loadShapes(projectId) {
    suppressSync = true;
    try {
      draw.clear();
      const shapes = await fetchShapes(projectId);
      if (shapes.length > 0) {
        draw.addFeatures(
          shapes.map((shape) => ({
            id: shape.id,
            type: "Feature",
            geometry: shape.geometry,
            properties: { ...shape.properties, mode: "polygon" },
          }))
        );
      }
    } finally {
      suppressSync = false;
    }
  }

  await loadShapes(getCurrentProjectId());

  return {
    draw,
    getSelectedId: () => selectedId,
    setCurrentStyle(style) {
      draw.currentStyle = { ...draw.currentStyle, ...style };
    },
    applyStyleToSelected(style) {
      if (!selectedId) return;
      draw.updateFeatureProperties(selectedId, style);
    },
    deleteSelected() {
      if (!selectedId) return;
      draw.removeFeatures([selectedId]);
      selectedId = null;
    },
    refreshShapes: loadShapes,
  };
}
