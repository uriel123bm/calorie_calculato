import type {
  PersonalPlanAnswers,
  PersonalPlanResult,
  PlanGender,
  PlanGoal,
  PlanPace,
  ProteinRange,
  TrainingFrequency,
  LifestyleActivity,
} from "../types/personalPlan";
import {
  buildGoalExplanation,
  buildPlanText,
  DISCLAIMER_HE,
  warningAggressivePace,
  warningLowCalories,
} from "./personalPlanCopy";

const MIN_CALORIES_MALE = 1500;
const MIN_CALORIES_FEMALE = 1200;

const TRAINING_BASE: Record<TrainingFrequency, number> = {
  "0": 1.2,
  "1_2": 1.375,
  "3_4": 1.55,
  "5_6": 1.725,
  "7_plus": 1.9,
};

const LIFESTYLE_BUMP: Record<LifestyleActivity, number> = {
  sedentary: 0,
  light_walk: 0.05,
  standing: 0.1,
  physical_job: 0.15,
};

const LOSE_ADJUST: Record<PlanPace, number> = {
  slow: -250,
  moderate: -500,
  aggressive: -750,
};

const GAIN_ADJUST: Record<PlanPace, number> = {
  slow: 200,
  moderate: 350,
  aggressive: 500,
};

/** Mifflin-St Jeor BMR (kcal/day). */
export function calculateBMR(
  gender: PlanGender,
  weightKg: number,
  heightCm: number,
  age: number
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(gender === "male" ? base + 5 : base - 161);
}

/**
 * Combine workout frequency (primary) with daily lifestyle bump, capped at 1.9.
 */
export function resolveActivityFactor(
  training: TrainingFrequency,
  lifestyle: LifestyleActivity
): number {
  const raw = TRAINING_BASE[training] + LIFESTYLE_BUMP[lifestyle];
  return Math.round(Math.min(1.9, raw) * 1000) / 1000;
}

export function calculateTDEE(bmr: number, activityFactor: number): number {
  return Math.round(bmr * activityFactor);
}

export function calculateTargetCalories(
  tdee: number,
  goal: PlanGoal,
  pace?: PlanPace
): number {
  if (goal === "maintain") return tdee;
  const p = pace ?? "moderate";
  if (goal === "lose") return Math.round(tdee + LOSE_ADJUST[p]);
  return Math.round(tdee + GAIN_ADJUST[p]);
}

export function calculateProteinRange(
  weightKg: number,
  goal: PlanGoal
): ProteinRange {
  const [minPerKg, maxPerKg] =
    goal === "maintain" ? [1.2, 1.8] : [1.6, 2.2];
  return {
    minG: Math.round(weightKg * minPerKg),
    maxG: Math.round(weightKg * maxPerKg),
  };
}

function collectWarnings(
  answers: PersonalPlanAnswers,
  targetCalories: number
): string[] {
  const warnings: string[] = [];
  const min =
    answers.gender === "male" ? MIN_CALORIES_MALE : MIN_CALORIES_FEMALE;
  if (targetCalories < min) {
    warnings.push(warningLowCalories(answers.gender, min));
  }
  if (
    answers.pace === "aggressive" &&
    (answers.goal === "lose" || answers.goal === "gain")
  ) {
    warnings.push(warningAggressivePace(answers.goal));
  }
  return warnings;
}

export function buildPlanResult(answers: PersonalPlanAnswers): PersonalPlanResult {
  const bmr = calculateBMR(
    answers.gender,
    answers.weightKg,
    answers.heightCm,
    answers.age
  );
  const activityFactor = resolveActivityFactor(
    answers.trainingFrequency,
    answers.lifestyle
  );
  const tdee = calculateTDEE(bmr, activityFactor);
  const targetCalories = calculateTargetCalories(
    tdee,
    answers.goal,
    answers.pace
  );
  const protein = calculateProteinRange(answers.weightKg, answers.goal);
  const warnings = collectWarnings(answers, targetCalories);

  return {
    bmr,
    tdee,
    targetCalories,
    activityFactor,
    protein,
    warnings,
    goalExplanationHe: buildGoalExplanation(answers, targetCalories, tdee),
    planTextHe: buildPlanText(answers, targetCalories, protein),
    disclaimerHe: DISCLAIMER_HE,
  };
}

/** Validation bounds for questionnaire steps. */
export const PLAN_VALIDATION = {
  ageMin: 14,
  ageMax: 90,
  heightMin: 120,
  heightMax: 230,
  weightMin: 30,
  weightMax: 300,
} as const;
