export type HebrewUnit = "גרם" | 'מ"ל' | "כף" | "כפית" | "כוס" | "יחידה";

export const UNITS: HebrewUnit[] = ["גרם", 'מ"ל', "כף", "כפית", "כוס", "יחידה"];

export type NutritionSource =
  | "local"
  | "openfoodfacts"
  | "ai_estimate"
  | "manual"
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

export interface DailyEntryInput {
  name: string;
  calories: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
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
