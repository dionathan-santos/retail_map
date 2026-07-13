import { AY_COLORS } from "./brand-colors.js";

// Retail category palette — Avison Young brand colors, assigned so
// adjacent categories on the map read as distinct at a glance.
export const CATEGORIES = {
  grocery: { label: "Grocery", color: AY_COLORS.mint },
  pharmacy: { label: "Pharmacy", color: AY_COLORS.orange },
  fitness: { label: "Fitness", color: AY_COLORS.periwinkle },
  specialty: { label: "Specialty Retail", color: AY_COLORS.amethyst },
  restaurant: { label: "Restaurant / QSR", color: AY_COLORS.mauve },
  bank: { label: "Bank / Financial", color: AY_COLORS.midnight },
  other: { label: "Other", color: AY_COLORS.stoneGrey },
};

export function categoryColor(category) {
  return (CATEGORIES[category] || CATEGORIES.other).color;
}

export const ZONE_TIER_STYLE = {
  major: { color: AY_COLORS.amethyst, width: 3, dash: [1, 0] },
  secondary: { color: AY_COLORS.mauve, width: 1.5, dash: [2, 2] },
};
