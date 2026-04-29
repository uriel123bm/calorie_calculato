import type { HebrewUnit, NutritionPer100g, UserProduct } from "../types";
import { EMPTY_NUTRITION } from "../types";
import { gramsFromUnit, scaleServingMacros } from "./nutritionMath";

/** Normalize for loose equality (trim, collapse spaces). */
export function normalizeProductLabel(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/**
 * Exact match on normalized names (case-sensitive for Hebrew;
 * compares ASCII segments case-insensitively when overlapping).
 */
export function findPersonalProductByName(
  rawName: string,
  products: UserProduct[]
): UserProduct | null {
  const needle = normalizeProductLabel(rawName);
  if (!needle) return null;
  const lowerNeedle = needle.toLocaleLowerCase("he-IL");
  return (
    products.find((p) => normalizeProductLabel(p.name) === needle) ??
    products.find((p) => normalizeProductLabel(p.name).toLocaleLowerCase("he-IL") === lowerNeedle) ??
    null
  );
}

/** Macro totals for exactly `quantity` in the product's serving basis (same units as saved). */
export function totalsForProductQuantity(p: UserProduct, quantity: number) {
  return scaleServingMacros(p, quantity);
}

/**
 * Convert a saved personal product into per-100g nutrition for an ingredient row,
 * using the same gram conversion as the rest of the app (`gramsFromUnit`).
 */
export function personalProductToIngredientPer100g(p: UserProduct): NutritionPer100g {
  const unit = p.servingUnit as HebrewUnit;
  const qty = p.servingValue;
  const grams = gramsFromUnit(qty, unit);
  if (grams <= 0) return { ...EMPTY_NUTRITION };
  const t = scaleServingMacros(p, qty);
  const f = 100 / grams;
  return {
    calories: t.calories * f,
    protein: t.protein * f,
    carbohydrates: t.carbohydrates * f,
    sugar: 0,
    fat: t.fat * f,
    sodium: 0,
  };
}
