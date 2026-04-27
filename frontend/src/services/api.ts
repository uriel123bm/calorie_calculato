import axios from "axios";
import type {
  AnalyzeResponse,
  HebrewUnit,
  IngredientRowState,
  RecipeSummary,
} from "../types";

const baseURL =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

const client = axios.create({
  baseURL,
  timeout: 25000,
});

export async function analyzeIngredient(params: {
  ingredient_name: string;
  quantity: number;
  unit: HebrewUnit;
}): Promise<AnalyzeResponse> {
  const { data } = await client.post<AnalyzeResponse>(
    "/ingredients/analyze",
    params
  );
  return data;
}

export async function calculateRecipe(payload: {
  recipe_name: string | null;
  servings: number;
  ingredients: Array<{
    name: string;
    quantity: number;
    unit: HebrewUnit;
    nutrition_per_100g: IngredientRowState["nutritionPer100g"];
    unit_weight_g?: number;
  }>;
}): Promise<RecipeSummary> {
  const { data } = await client.post<RecipeSummary>(
    "/recipe/calculate",
    payload
  );
  return data;
}
