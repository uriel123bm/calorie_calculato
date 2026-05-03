export type HebrewUnit = "גרם" | "קילוגרם" | 'מ"ל' | "ליטר" | "כף" | "כפית" | "כוס" | "יחידה";

export const UNITS: HebrewUnit[] = ["גרם", "קילוגרם", 'מ"ל', "ליטר", "כף", "כפית", "כוס", "יחידה"];

export type NutritionSource =
  | "local"
  | "openfoodfacts"
  | "ai_estimate"
  | "manual"
  | "personal_library"
  | "unknown";

export interface NutritionPer100g {
  calories: number;
  protein: number;
  carbohydrates: number;
  sugar: number;
  fat: number;
  sodium: number;
}

export const EMPTY_NUTRITION: NutritionPer100g = {
  calories: 0,
  protein: 0,
  carbohydrates: 0,
  sugar: 0,
  fat: 0,
  sodium: 0,
};

export interface AnalyzeResponse {
  ingredient_name: string;
  nutrition_per_100g: NutritionPer100g;
  nutrition_for_quantity: NutritionPer100g;
  quantity_in_grams: number;
  confidence: number;
  source: NutritionSource;
  matched_name: string | null;
  /** Grams per יחידה when known (local DB); used to rescale rows without defaulting to 100g. */
  unit_weight_g?: number | null;
}

export interface IngredientRowState {
  id: string;
  name: string;
  quantity: number | "";
  unit: HebrewUnit;
  nutritionPer100g: NutritionPer100g;
  quantityInGrams: number;
  nutritionForQuantity: NutritionPer100g;
  confidence: number;
  source: NutritionSource | null;
  matchedName: string | null;
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
  unitWeightG?: number;
  showEditor: boolean;
  manualEdit: boolean;
  placeholder?: string;
}

export interface Meal {
  id: string;
  name: string;
}

export interface RecipeTotals {
  totalGrams: number;
  total: NutritionPer100g;
  per100g: NutritionPer100g;
  perServing: NutritionPer100g;
}

/** שורה בפירוט ארוחה שנוספה מהעורך (מצרכים בודדים). */
export interface DailyEntryLine {
  name: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  /** למשל "100 גרם" או "2 יחידה" */
  detail?: string;
}

export interface DailyEntryInput {
  name: string;
  calories: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  lines?: DailyEntryLine[];
}

export interface RecipeSummary {
  recipe_name: string | null;
  servings: number;
  total_weight_g: number;
  total: NutritionPer100g;
  per_100g: NutritionPer100g;
  per_serving: NutritionPer100g;
  breakdown: Array<{
    name: string;
    quantity_in_grams: number;
    nutrition: NutritionPer100g;
  }>;
}

export interface DailyEntry {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  addedAt: number;
  /** קיים כשנוסף מארוחה עם מצרכים — מאפשר פירוט במסך הבית וביומן */
  lines?: DailyEntryLine[];
}

export interface DailyTrackerState {
  date: string;
  targetCalories: number;
  entries: DailyEntry[];
}

export interface DayLog {
  date: string;          // YYYY-MM-DD
  targetCalories: number;
  entries: DailyEntry[];
}

/** A user-saved recipe stored in the personal recipe library */
export interface SavedRecipe {
  id: string;
  name: string;
  savedAt: number;          // Date.now()
  totalWeightG: number;     // total weight of the recipe in grams
  per100g: NutritionPer100g;
  /** Legacy field from older saves — omitted for per-grams recipes */
  servings?: number;
}

/**
 * A user-defined personal product stored as per-unit macros.
 * `servingValue` + `servingUnit` define the quantity basis used for scaling.
 */
export type ServingUnit = "גרם" | 'מ"ל' | "יחידה";

export interface UserProduct {
  id: string;
  name: string;
  servingValue: number;       // basis quantity (defaults to 1)
  servingUnit: ServingUnit;   // basis unit (defaults to "יחידה")
  /** Optional display hint for what one unit contains (e.g. "330 מ״ל"). */
  unitDescription?: string;
  /** How many logical units the entered package totals represent. */
  servingsCount?: number;
  calories: number;           // per serving
  protein: number;            // per serving
  carbohydrates: number;      // per serving
  fat: number;                // per serving
  addedAt: number;            // Date.now()
}

/** Onboarding profile + history for the progress page. */
export type Sex = "male" | "female" | "other";
export type Goal = "lose" | "cut" | "maintain" | "gain";

/** היקפי גוף בס״מ — אופציונלי, לפי בחירת המשתמש יחד עם מדידת משקל. */
export interface BodyCircumferences {
  waistCm?: number;
  hipsCm?: number;
  chestCm?: number;
}

export interface WeightLogEntry {
  date: string;     // YYYY-MM-DD
  weightKg: number;
  circumferences?: BodyCircumferences;
}

export interface BodyMetrics {
  /** Display name (optional). */
  name?: string;
  heightCm: number;
  /** Initial weight from onboarding (kept stable for BMI/baseline calculations). */
  startWeightKg: number;
  /** Most recent recorded weight (mirrors the last item in `log`). */
  currentWeightKg: number;
  age?: number;
  sex?: Sex;
  goal?: Goal;
  goalWeightKg?: number;
  /** Append-only list of weight measurements over time. */
  log: WeightLogEntry[];
  createdAt: number;
  updatedAt: number;
}
