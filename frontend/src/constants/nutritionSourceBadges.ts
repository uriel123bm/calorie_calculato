/** Labels for nutrition `source` values (matches IngredientRow badges). */
export const NUTRITION_SOURCE_BADGES: Record<string, { label: string; cls: string }> = {
  local: { label: "מאגר מקומי", cls: "local" },
  openfoodfacts: { label: "Open Food Facts", cls: "openfoodfacts" },
  ai_estimate: { label: "הערכת AI", cls: "ai" },
  manual: { label: "עריכה ידנית", cls: "manual" },
  personal_library: { label: "מהספרייה שלי", cls: "personal-library" },
  unknown: { label: "לא נמצא", cls: "unknown" },
};
