import { describe, expect, it } from "vitest";
import type { NutritionPer100g, UserProduct } from "../types";
import {
  aggregatePer100g,
  divideTotalsByServings,
  gramsFromUnit,
  scaleNutrition,
  scaleServingMacros,
  sumNutrition,
} from "./nutritionMath";

/** Mirrors backend `calculator.for_quantity` mental model for tests. */
function pyForQuantity(per100: NutritionPer100g, grams: number): NutritionPer100g {
  if (grams <= 0) {
    return {
      calories: 0,
      protein: 0,
      carbohydrates: 0,
      sugar: 0,
      fat: 0,
      sodium: 0,
    };
  }
  const f = grams / 100;
  return {
    calories: per100.calories * f,
    protein: per100.protein * f,
    carbohydrates: per100.carbohydrates * f,
    sugar: per100.sugar * f,
    fat: per100.fat * f,
    sodium: per100.sodium * f,
  };
}

describe("nutritionMath", () => {
  const sample: NutritionPer100g = {
    calories: 250,
    protein: 10,
    carbohydrates: 30,
    sugar: 5,
    fat: 12,
    sodium: 100,
  };

  it("scaleNutrition matches per_100g * grams / 100", () => {
    expect(scaleNutrition(sample, 250)).toEqual(pyForQuantity(sample, 250));
    expect(scaleNutrition(sample, 0)).toMatchObject({
      calories: 0,
      protein: 0,
      carbohydrates: 0,
      sugar: 0,
      fat: 0,
      sodium: 0,
    });
  });

  it("sumNutrition adds component-wise", () => {
    const a = scaleNutrition(sample, 100);
    const b = scaleNutrition(sample, 50);
    const s = sumNutrition([a, b]);
    expect(s.calories).toBeCloseTo(a.calories + b.calories);
    expect(s.protein).toBeCloseTo(a.protein + b.protein);
  });

  it("aggregatePer100g inverts total weight", () => {
    const total = scaleNutrition(sample, 350);
    const back = aggregatePer100g(total, 350);
    expect(back.calories).toBeCloseTo(sample.calories);
    expect(back.protein).toBeCloseTo(sample.protein);
  });

  it("divideTotalsByServings matches servings divisor", () => {
    const total = scaleNutrition(sample, 400);
    const per = divideTotalsByServings(total, 4);
    expect(per.calories).toBeCloseTo(total.calories / 4);
  });

  it("gramsFromUnit matches ml=g for liquids", () => {
    expect(gramsFromUnit(500, 'מ"ל')).toBe(500);
    expect(gramsFromUnit(2, "כף")).toBe(30);
  });

  it("scaleServingMacros scales personal products linearly", () => {
    const p: UserProduct = {
      id: "x",
      name: "shake",
      servingValue: 500,
      servingUnit: 'מ"ל',
      calories: 200,
      protein: 50,
      carbohydrates: 10,
      fat: 2,
      addedAt: 1,
    };
    const half = scaleServingMacros(p, 250);
    expect(half.calories).toBe(100);
    expect(half.protein).toBe(25);
    expect(half.carbohydrates).toBe(5);
    expect(half.fat).toBe(1);
  });
});
