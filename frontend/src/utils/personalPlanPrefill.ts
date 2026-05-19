import type { BodyMetrics, Goal, Sex } from "../types";
import type {
  PersonalPlanAnswers,
  PlanGender,
  PlanGoal,
} from "../types/personalPlan";

export function sexToPlanGender(sex?: Sex): PlanGender | undefined {
  if (sex === "male") return "male";
  if (sex === "female") return "female";
  return undefined;
}

export function bodyGoalToPlanGoal(goal?: Goal): PlanGoal | undefined {
  if (goal === "maintain") return "maintain";
  if (goal === "gain") return "gain";
  if (goal === "lose" || goal === "cut") return "lose";
  return undefined;
}

export function planGoalToBodyGoal(goal: PlanGoal): Goal {
  if (goal === "maintain") return "maintain";
  if (goal === "gain") return "gain";
  return "lose";
}

export function buildInitialAnswers(
  existing?: PersonalPlanAnswers | null,
  body?: BodyMetrics | null
): Partial<PersonalPlanAnswers> {
  if (existing) return { ...existing };
  if (!body) return {};
  return {
    gender: sexToPlanGender(body.sex),
    age: body.age,
    heightCm: body.heightCm,
    weightKg: body.currentWeightKg,
    goal: bodyGoalToPlanGoal(body.goal),
  };
}
