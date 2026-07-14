import { fetchProjects, createProjectApi, deleteProjectApi } from "../api.js";
import { getCurrentProject, setCurrentProject } from "../current-project.js";
import { refreshPoints } from "../map.js";

let mapRef = null;
let drawApiRef = null;
let panelRef = null;

// Switches which "environment" points/shapes are read from and written to:
// a project (isolated, permanent) or the base map (shared, temporary --
// see the 24h cleanup in worker/index.js). Every tool that creates points
// or shapes (point-form.js, bulk-upload.js, draw.js) reads
// current-project.js at write time, so nothing here needs to know about
// those tools directly -- switching the active project and refetching is
// enough to keep the map in sync.
export function renderProjectsPanel(map, drawApi) {
  mapRef = map;
  drawApiRef = drawApi;
  panelRef = document.getElementById("projects-panel");
  render();
}

async function render() {
  panelRef.innerHTML = "";

  const heading = document.createElement("h3");
  heading.textContent = "Projects";
  panelRef.appendChild(heading);

  const current = getCurrentProject();
  if (current) {
    panelRef.appendChild(renderActiveProjectBanner(current));
  } else {
    panelRef.appendChild(renderBaseMapNotice());
  }

  const newProjectBtn = document.createElement("button");
  newProjectBtn.className = "projects-new-btn";
  newProjectBtn.textContent = "+ New Project";
  newProjectBtn.addEventListener("click", openNewProjectModal);
  panelRef.appendChild(newProjectBtn);

  const listHeading = document.createElement("h4");
  listHeading.textContent = "Saved";
  panelRef.appendChild(listHeading);

  const loading = document.createElement("p");
  loading.className = "projects-empty";
  loading.textContent = "Loading…";
  panelRef.appendChild(loading);

  let projects;
  try {
    projects = await fetchProjects();
  } catch (err) {
    loading.textContent = `Error: ${err.message}`;
    return;
  }
  loading.remove();

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

function renderActiveProjectBanner(project) {
  const box = document.createElement("div");
  box.className = "active-project-box";

  const title = document.createElement("div");
  title.className = "active-project-title";
  title.textContent = `Inside: ${project.name}`;
  box.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "active-project-meta";
  meta.textContent = `Client: ${project.client} · By: ${project.user}`;
  box.appendChild(meta);

  const note = document.createElement("p");
  note.className = "projects-note";
  note.textContent = "Everything you add or draw here is saved to this project only.";
  box.appendChild(note);

  const exitBtn = document.createElement("button");
  exitBtn.className = "projects-close-btn";
  exitBtn.textContent = "Exit to Base Map";
  exitBtn.addEventListener("click", () => switchProject(null));
  box.appendChild(exitBtn);

  return box;
}

function renderBaseMapNotice() {
  const note = document.createElement("p");
  note.className = "projects-note projects-note-base";
  note.textContent =
    "You're on the base map. Points and shapes added here are temporary and are cleared after 24 hours. Open a project to save your work.";
  return note;
}

function renderProjectRow(project) {
  const current = getCurrentProject();
  const row = document.createElement("div");
  row.className = "project-row";
  if (current?.id === project.id) row.classList.add("active");

  const info = document.createElement("div");
  info.className = "project-row-info";
  info.innerHTML = `<strong>${escapeHtml(project.name)}</strong><br>
    <span>${escapeHtml(project.client)} · ${escapeHtml(project.user)}</span>`;
  row.appendChild(info);

  const actions = document.createElement("div");
  actions.className = "project-row-actions";

  const openBtn = document.createElement("button");
  openBtn.textContent = current?.id === project.id ? "Open" : "Enter";
  openBtn.disabled = current?.id === project.id;
  openBtn.addEventListener("click", () => switchProject(project));
  actions.appendChild(openBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Delete";
  deleteBtn.className = "project-delete-btn";
  deleteBtn.addEventListener("click", async () => {
    if (!confirm(`Delete project "${project.name}"? This also deletes all its points and shapes.`)) return;
    await deleteProjectApi(project.id);
    if (current?.id === project.id) {
      await switchProject(null);
    } else {
      await render();
    }
  });
  actions.appendChild(deleteBtn);

  row.appendChild(actions);
  return row;
}

async function switchProject(project) {
  setCurrentProject(project);
  await Promise.all([refreshPoints(mapRef), drawApiRef.refreshShapes(project?.id ?? null)]);
  await render();
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

  overlay.querySelector("#new-project-submit").addEventListener("click", async () => {
    const name = overlay.querySelector("#new-project-name").value.trim();
    const client = overlay.querySelector("#new-project-client").value.trim();
    const user = overlay.querySelector("#new-project-user").value.trim();

    if (!name || !client || !user) {
      alert("Fill in the project name, client name, and user name.");
      return;
    }

    const project = await createProjectApi({ name, client, user });
    closeModal();
    await switchProject(project);
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
