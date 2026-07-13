import * as XLSX from "xlsx";
import { createPointsBulk } from "../api.js";
import { refreshPoints } from "../map.js";

// Bulk upload: parses an uploaded Excel file client-side (CM Land Tracker
// convention: name, category, lat, lng, address, status, source,
// last_updated) and posts rows through the same /api/points/bulk endpoint
// scripts/excel-to-geojson.py's schema was built for, so single-add and
// bulk stay consistent.
const REQUIRED_COLUMNS = ["name", "category", "lat", "lng"];

export function renderBulkUpload(map) {
  const panel = document.getElementById("bulk-upload-panel");
  panel.innerHTML = `
    <h3>Bulk Upload</h3>
    <input type="file" id="bulk-file" accept=".xlsx,.xls,.csv" />
    <p id="bulk-status"></p>
  `;

  const fileInput = panel.querySelector("#bulk-file");
  const status = panel.querySelector("#bulk-status");

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    status.textContent = "Parsing...";

    try {
      const rows = await parseExcel(file);
      const { points, skipped } = toPoints(rows);
      if (points.length === 0) {
        status.textContent = "No valid rows found (need name, category, lat, lng).";
        return;
      }

      const result = await createPointsBulk(points);
      await refreshPoints(map);
      status.textContent = `Inserted ${result.inserted} point(s).` + (skipped ? ` Skipped ${skipped} invalid row(s).` : "");
    } catch (err) {
      status.textContent = `Error: ${err.message}`;
    } finally {
      fileInput.value = "";
    }
  });
}

function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(sheet, { defval: null }));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function toPoints(rows) {
  const points = [];
  let skipped = 0;
  for (const row of rows) {
    const hasRequired = REQUIRED_COLUMNS.every((c) => row[c] !== null && row[c] !== undefined && row[c] !== "");
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (!hasRequired || Number.isNaN(lat) || Number.isNaN(lng)) {
      skipped++;
      continue;
    }
    points.push({
      name: String(row.name),
      category: String(row.category),
      lat,
      lng,
      address: row.address ? String(row.address) : null,
      status: row.status ? String(row.status) : "active",
      source: row.source ? String(row.source) : null,
      last_updated: row.last_updated ? String(row.last_updated) : null,
    });
  }
  return { points, skipped };
}
