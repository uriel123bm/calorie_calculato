import type { UseBodyMetricsResult } from "../hooks/useBodyMetrics";
import { DEFAULT_MACRO_TARGETS } from "../hooks/useUserSettings";
import type { MacroTargets } from "../hooks/useUserSettings";
import type { PersonalPlanAnswers, PersonalPlanResult } from "../types/personalPlan";
import { planGoalToBodyGoal } from "./personalPlanPrefill";

export function applyPersonalPlanToApp({
  answers,
  result,
  setTarget,
  body,
  patchMacroTargets,
  existingMacroTargets,
}: {
  answers: PersonalPlanAnswers;
  result: PersonalPlanResult;
  setTarget: (n: number) => void;
  body: UseBodyMetricsResult;
  patchMacroTargets: (targets: MacroTargets) => void;
  existingMacroTargets?: MacroTargets;
}): void {
  setTarget(result.targetCalories);

  const bodyGoal = planGoalToBodyGoal(answers.goal);
  if (!body.metrics) {
    body.setOnboarding({
      heightCm: answers.heightCm,
      startWeightKg: answers.weightKg,
      age: answers.age,
      sex: answers.gender,
      goal: bodyGoal,
    });
  } else {
    body.updateMetrics({
      heightCm: answers.heightCm,
      age: answers.age,
      sex: answers.gender,
      goal: bodyGoal,
      currentWeightKg: answers.weightKg,
    });
    body.addWeight(answers.weightKg);
  }

  if (answers.preference !== "calories_only") {
    const proteinMid = Math.round((result.protein.minG + result.protein.maxG) / 2);
    const base = existingMacroTargets ?? DEFAULT_MACRO_TARGETS;
    patchMacroTargets({
      ...base,
      protein: proteinMid,
    });
  }
}
