import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
} from "../projects-store.js";
import { setProjectPoints, TOGGLEABLE_LAYERS } from "../map.js";

let activeProjectId = null;
let addPointMode = false;
let mapRef = null;
let panelRef = null;
let onMapClick = null;

export function renderProjectsPanel(map) {
  mapRef = map;
  panelRef = document.getElementById("projects-panel");
  render();
}

function render() {
  panelRef.innerHTML = "";

  const heading = document.createElement("h3");
  heading.textContent = "Projects";
  panelRef.appendChild(heading);

  const newProjectBtn = document.createElement("button");
  newProjectBtn.className = "projects-new-btn";
  newProjectBtn.textContent = "+ New Project";
  newProjectBtn.addEventListener("click", openNewProjectModal);
  panelRef.appendChild(newProjectBtn);

  const activeProject = activeProjectId ? getProject(activeProjectId) : null;
  if (activeProject) {
    panelRef.appendChild(renderActiveProject(activeProject));
  }

  const listHeading = document.createElement("h4");
  listHeading.textContent = "Saved";
  panelRef.appendChild(listHeading);

  const projects = listProjects();
  if (projects.length === 0) {
    const empty = document.createElement("p");
    empty.className = "projects-empty";
    empty.textContent = "No saved projects yet.";
    panelRef.appendChild(empty);
  }

  for (const project of projects) {
    panelRef.appendChild(renderProjectRow(project));
  }
}

function renderActiveProject(project) {
  const box = document.createElement("div");
  box.className = "active-project-box";

  const title = document.createElement("div");
  title.className = "active-project-title";
  title.textContent = project.name;
  box.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "active-project-meta";
  meta.textContent = `Client: ${project.client} · By: ${project.user}`;
  box.appendChild(meta);

  const addPointBtn = document.createElement("button");
  addPointBtn.className = "projects-add-point-btn";
  addPointBtn.textContent = addPointMode ? "Click the map to add…" : "Add Point";
  addPointBtn.classList.toggle("active", addPointMode);
  addPointBtn.addEventListener("click", () => toggleAddPointMode());
  box.appendChild(addPointBtn);

  const pointsList = document.createElement("ul");
  pointsList.className = "project-points-list";
  for (const point of project.points) {
    const li = document.createElement("li");

    const label = document.createElement("span");
    label.textContent = point.label;
    li.appendChild(label);

    const removeBtn = document.createElement("button");
    removeBtn.className = "project-point-remove";
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", () => removePoint(project.id, point.id));
    li.appendChild(removeBtn);

    pointsList.appendChild(li);
  }
  box.appendChild(pointsList);

  const saveBtn = document.createElement("button");
  saveBtn.className = "projects-save-btn";
  saveBtn.textContent = "Save Current View";
  saveBtn.title = "Saves the map's current position/zoom and visible layers to the project";
  saveBtn.addEventListener("click", () => saveCurrentView(project.id));
  box.appendChild(saveBtn);

  const closeBtn = document.createElement("button");
  closeBtn.className = "projects-close-btn";
  closeBtn.textContent = "Close Project";
  closeBtn.addEventListener("click", () => setActiveProject(null));
  box.appendChild(closeBtn);

  return box;
}

function renderProjectRow(project) {
  const row = document.createElement("div");
  row.className = "project-row";
  if (project.id === activeProjectId) row.classList.add("active");

  const info = document.createElement("div");
  info.className = "project-row-info";
  info.innerHTML = `<strong>${escapeHtml(project.name)}</strong><br>
    <span>${escapeHtml(project.client)} · ${escapeHtml(project.user)}</span>`;
  row.appendChild(info);

  const actions = document.createElement("div");
  actions.className = "project-row-actions";

  const openBtn = document.createElement("button");
  openBtn.textContent = "Open";
  openBtn.addEventListener("click", () => setActiveProject(project.id));
  actions.appendChild(openBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Delete";
  deleteBtn.className = "project-delete-btn";
  deleteBtn.addEventListener("click", () => {
    if (!confirm(`Delete project "${project.name}"?`)) return;
    deleteProject(project.id);
    if (activeProjectId === project.id) setActiveProject(null);
    else render();
  });
  actions.appendChild(deleteBtn);

  row.appendChild(actions);
  return row;
}

function setActiveProject(id) {
  disableAddPointMode();
  activeProjectId = id;

  const project = id ? getProject(id) : null;
  if (project) {
    mapRef.jumpTo({ center: project.view.center, zoom: project.view.zoom });
    for (const [toggleId, visible] of Object.entries(project.layers)) {
      const checkbox = document.getElementById(toggleId);
      if (checkbox) checkbox.checked = visible;
    }
    setProjectPoints(mapRef, project.points);
  } else {
    setProjectPoints(mapRef, []);
  }

  render();
}

function toggleAddPointMode() {
  addPointMode = !addPointMode;
  if (addPointMode) {
    onMapClick = (e) => {
      const label = prompt("Point name:");
      if (label) addPoint(activeProjectId, e.lngLat.lng, e.lngLat.lat, label);
      disableAddPointMode();
    };
    mapRef.on("click", onMapClick);
    mapRef.getCanvas().style.cursor = "crosshair";
  } else {
    disableAddPointMode();
  }
  render();
}

function disableAddPointMode() {
  addPointMode = false;
  if (onMapClick) {
    mapRef.off("click", onMapClick);
    onMapClick = null;
  }
  if (mapRef) mapRef.getCanvas().style.cursor = "";
}

function addPoint(projectId, lng, lat, label) {
  const project = getProject(projectId);
  if (!project) return;

  const point = { id: crypto.randomUUID(), lng, lat, label };
  const points = [...project.points, point];
  updateProject(projectId, { points });
  setProjectPoints(mapRef, points);
  render();
}

function removePoint(projectId, pointId) {
  const project = getProject(projectId);
  if (!project) return;

  const points = project.points.filter((p) => p.id !== pointId);
  updateProject(projectId, { points });
  setProjectPoints(mapRef, points);
  render();
}

function saveCurrentView(projectId) {
  updateProject(projectId, {
    view: currentView(),
    layers: currentLayerVisibility(),
  });
  render();
}

function currentView() {
  const center = mapRef.getCenter();
  return { center: [center.lng, center.lat], zoom: mapRef.getZoom() };
}

function currentLayerVisibility() {
  const layers = {};
  for (const toggleId of Object.keys(TOGGLEABLE_LAYERS)) {
    const checkbox = document.getElementById(toggleId);
    layers[toggleId] = checkbox ? checkbox.checked : true;
  }
  return layers;
}

function openNewProjectModal() {
  const overlay = document.getElementById("project-modal-overlay");
  overlay.innerHTML = "";
  overlay.classList.add("visible");

  const modal = document.createElement("div");
  modal.className = "project-modal";
  modal.innerHTML = `
    <h3>New Project</h3>
    <label>Project Name<input type="text" id="new-project-name" required></label>
    <label>Client Name<input type="text" id="new-project-client" required></label>
    <label>User Name<input type="text" id="new-project-user" required></label>
    <div class="project-modal-actions">
      <button type="button" id="new-project-cancel">Cancel</button>
      <button type="button" id="new-project-submit">Create Project</button>
    </div>
  `;
  overlay.appendChild(modal);

  overlay.querySelector("#new-project-cancel").addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  overlay.querySelector("#new-project-submit").addEventListener("click", () => {
    const name = overlay.querySelector("#new-project-name").value.trim();
    const client = overlay.querySelector("#new-project-client").value.trim();
    const user = overlay.querySelector("#new-project-user").value.trim();

    if (!name || !client || !user) {
      alert("Fill in the project name, client name, and user name.");
      return;
    }

    const project = createProject({
      name,
      client,
      user,
      view: currentView(),
      layers: currentLayerVisibility(),
    });
    closeModal();
    setActiveProject(project.id);
  });
}

function closeModal() {
  const overlay = document.getElementById("project-modal-overlay");
  overlay.classList.remove("visible");
  overlay.innerHTML = "";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
