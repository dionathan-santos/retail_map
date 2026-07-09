// Retail category palette — inspired by the source Avison Young PDF's pin
// hierarchy, tuned to sit alongside CM Land Tracker's existing brand colors.
export const CATEGORIES = {
  grocery: { label: "Grocery", color: "#1B7A3D" },
  pharmacy: { label: "Pharmacy", color: "#C0392B" },
  fitness: { label: "Fitness", color: "#E08E0B" },
  specialty: { label: "Specialty Retail", color: "#5B3A9B" },
  restaurant: { label: "Restaurant / QSR", color: "#B5590A" },
  bank: { label: "Bank / Financial", color: "#1F4E79" },
  other: { label: "Other", color: "#6B7280" },
};

export function categoryColor(category) {
  return (CATEGORIES[category] || CATEGORIES.other).color;
}

export const ZONE_TIER_STYLE = {
  major: { color: "#1F4E79", width: 3, dash: [1, 0] },
  secondary: { color: "#1F4E79", width: 1.5, dash: [2, 2] },
};
