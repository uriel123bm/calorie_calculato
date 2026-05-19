/** Gender for Mifflin-St Jeor BMR. */
export type PlanGender = "male" | "female";

export type PlanGoal = "lose" | "maintain" | "gain";

/** Pace applies only when goal is lose or gain. */
export type PlanPace = "slow" | "moderate" | "aggressive";

export type TrainingFrequency = "0" | "1_2" | "3_4" | "5_6" | "7_plus";

export type LifestyleActivity =
  | "sedentary"
  | "light_walk"
  | "standing"
  | "physical_job";

export type PlanPreference = "calories_only" | "calories_protein" | "full";

export interface PersonalPlanAnswers {
  gender: PlanGender;
  age: number;
  heightCm: number;
  weightKg: number;
  goal: PlanGoal;
  pace?: PlanPace;
  trainingFrequency: TrainingFrequency;
  lifestyle: LifestyleActivity;
  preference: PlanPreference;
}

export interface ProteinRange {
  minG: number;
  maxG: number;
}

export interface PersonalPlanResult {
  bmr: number;
  tdee: number;
  targetCalories: number;
  activityFactor: number;
  protein: ProteinRange;
  warnings: string[];
  goalExplanationHe: string;
  planTextHe: string;
  disclaimerHe: string;
}

export interface PersonalPlanRecord {
  answers: PersonalPlanAnswers;
  result: PersonalPlanResult;
  completedAt: number;
}
