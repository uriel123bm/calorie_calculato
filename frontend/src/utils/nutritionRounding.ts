/** Consistent calorie/macro rounding for diary and meal totals (matches Ingredient flows). */

export function roundCalories(n: number): number {
  return Math.round(n);
}

export function roundMacro(n: number): number {
  return Math.round(n * 10) / 10;
}
