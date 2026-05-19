import { describe, expect, it } from "vitest";
import type { PersonalPlanAnswers } from "../types/personalPlan";
import { buildProfileRecap, buildCalculationSteps } from "./personalPlanCopy";
import {
  buildPlanResult,
  calculateBMR,
  calculateProteinRange,
  calculateTargetCalories,
  calculateTDEE,
  resolveActivityFactor,
} from "./tdeeCalculator";

const baseAnswers: PersonalPlanAnswers = {
  gender: "male",
  age: 30,
  heightCm: 175,
  weightKg: 80,
  goal: "lose",
  pace: "moderate",
  trainingFrequency: "3_4",
  lifestyle: "sedentary",
  preference: "calories_protein",
};

describe("calculateBMR", () => {
  it("computes male BMR (Mifflin-St Jeor)", () => {
    // 10*80 + 6.25*175 - 5*30 + 5 = 800 + 1093.75 - 150 + 5 = 1748.75 → 1749
    expect(calculateBMR("male", 80, 175, 30)).toBe(1749);
  });

  it("computes female BMR", () => {
    // 10*60 + 6.25*165 - 5*28 - 161 = 600 + 1031.25 - 140 - 161 = 1330.25 → 1330
    expect(calculateBMR("female", 60, 165, 28)).toBe(1330);
  });
});

describe("resolveActivityFactor", () => {
  it("uses training base with lifestyle bump capped at 1.9", () => {
    expect(resolveActivityFactor("0", "sedentary")).toBe(1.2);
    expect(resolveActivityFactor("1_2", "light_walk")).toBe(1.425);
    expect(resolveActivityFactor("7_plus", "physical_job")).toBe(1.9);
  });
});

describe("calculateTDEE and target", () => {
  it("TDEE = BMR * factor", () => {
    const bmr = 1749;
    const factor = 1.55;
    expect(calculateTDEE(bmr, factor)).toBe(2711);
  });

  it("lose moderate subtracts 500", () => {
    expect(calculateTargetCalories(2500, "lose", "moderate")).toBe(2000);
  });

  it("maintain equals TDEE", () => {
    expect(calculateTargetCalories(2200, "maintain")).toBe(2200);
  });

  it("gain slow adds 200", () => {
    expect(calculateTargetCalories(2500, "gain", "slow")).toBe(2700);
  });
});

describe("calculateProteinRange", () => {
  it("lose uses 1.6–2.2 g/kg", () => {
    expect(calculateProteinRange(80, "lose")).toEqual({ minG: 128, maxG: 176 });
  });

  it("maintain uses 1.2–1.8 g/kg", () => {
    expect(calculateProteinRange(70, "maintain")).toEqual({ minG: 84, maxG: 126 });
  });
});

describe("buildPlanResult", () => {
  it("adds low-calorie warning for aggressive female deficit", () => {
    const answers: PersonalPlanAnswers = {
      ...baseAnswers,
      gender: "female",
      age: 45,
      heightCm: 160,
      weightKg: 55,
      goal: "lose",
      pace: "aggressive",
      trainingFrequency: "0",
      lifestyle: "sedentary",
    };
    const result = buildPlanResult(answers);
    expect(result.targetCalories).toBeLessThan(1200);
    expect(result.warnings.some((w) => w.includes("1200"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("אגרסיבי"))).toBe(true);
  });

  it("includes disclaimer", () => {
    const result = buildPlanResult(baseAnswers);
    expect(result.disclaimerHe).toContain("הערכה בלבד");
  });

  it("builds profile recap and why steps", () => {
    const result = buildPlanResult(baseAnswers);
    const recap = buildProfileRecap(baseAnswers);
    expect(recap.some((r) => r.label === "מטרה")).toBe(true);
    const steps = buildCalculationSteps(baseAnswers, result);
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(steps[0]).toContain("חילוף החומרים");
  });
});
