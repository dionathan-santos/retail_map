// Default category palette, mirroring the legend on the original Avison
// Young "Edmonton Retail Network" map. Users can override color/shape per
// category (persisted in D1, see /functions/api/category-styles) or per
// individual point.
export const DEFAULT_CATEGORIES = {
  grocery: { label: "Grocery", color: "#1B7A3D", shape: "circle" },
  pharmacy: { label: "Pharmacy", color: "#C0392B", shape: "cross" },
  fitness: { label: "Fitness", color: "#E08E0B", shape: "triangle" },
  furniture_home: { label: "Furniture / Home", color: "#8E5A2E", shape: "square" },
  large_format_anchor: { label: "Large Format Anchor", color: "#1F4E79", shape: "diamond" },
  specialty: { label: "Specialty", color: "#5B3A9B", shape: "star" },
  enclosed_malls: { label: "Enclosed Malls", color: "#B5590A", shape: "hexagon" },
  other: { label: "Other", color: "#6B7280", shape: "circle" },
};

export const SHAPES = ["circle", "square", "triangle", "diamond", "star", "hexagon", "cross"];

// Merges user-saved overrides (from D1) on top of the defaults. `overrides`
// is a plain object keyed by category id, same shape as DEFAULT_CATEGORIES entries.
export function mergeCategories(overrides = {}) {
  const merged = {};
  for (const key of Object.keys(DEFAULT_CATEGORIES)) {
    merged[key] = { ...DEFAULT_CATEGORIES[key], ...overrides[key] };
  }
  for (const key of Object.keys(overrides)) {
    if (!merged[key]) merged[key] = { label: key, color: "#6B7280", shape: "circle", ...overrides[key] };
  }
  return merged;
}

export function categoryStyle(categories, category) {
  return categories[category] || categories.other || DEFAULT_CATEGORIES.other;
}

// Draws a shape to a canvas and returns image data usable with map.addImage.
// Works identically for the live MapLibre canvas and the exported canvas
// snapshot, since both just read from the same registered sprite image.
export function drawIcon(shape, color, size = 48) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const c = size / 2;
  const r = size * 0.36;

  ctx.fillStyle = color;
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = size * 0.06;

  ctx.beginPath();
  switch (shape) {
    case "square":
      ctx.rect(c - r, c - r, r * 2, r * 2);
      break;
    case "triangle":
      ctx.moveTo(c, c - r);
      ctx.lineTo(c + r, c + r);
      ctx.lineTo(c - r, c + r);
      ctx.closePath();
      break;
    case "diamond":
      ctx.moveTo(c, c - r);
      ctx.lineTo(c + r, c);
      ctx.lineTo(c, c + r);
      ctx.lineTo(c - r, c);
      ctx.closePath();
      break;
    case "star":
      drawStar(ctx, c, c, 5, r, r * 0.45);
      break;
    case "hexagon":
      drawPolygon(ctx, c, c, 6, r);
      break;
    case "cross":
      drawCross(ctx, c, c, r);
      break;
    case "circle":
    default:
      ctx.arc(c, c, r, 0, Math.PI * 2);
      break;
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  return ctx.getImageData(0, 0, size, size);
}

function drawPolygon(ctx, cx, cy, sides, r) {
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
}

function drawStar(ctx, cx, cy, points, rOuter, rInner) {
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const angle = (Math.PI * i) / points - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
}

function drawCross(ctx, cx, cy, r) {
  const w = r * 0.4;
  ctx.moveTo(cx - w, cy - r);
  ctx.lineTo(cx + w, cy - r);
  ctx.lineTo(cx + w, cy - w);
  ctx.lineTo(cx + r, cy - w);
  ctx.lineTo(cx + r, cy + w);
  ctx.lineTo(cx + w, cy + w);
  ctx.lineTo(cx + w, cy + r);
  ctx.lineTo(cx - w, cy + r);
  ctx.lineTo(cx - w, cy + w);
  ctx.lineTo(cx - r, cy + w);
  ctx.lineTo(cx - r, cy - w);
  ctx.lineTo(cx - w, cy - w);
}
