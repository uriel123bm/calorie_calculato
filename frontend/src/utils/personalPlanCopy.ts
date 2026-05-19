import type {
  PersonalPlanAnswers,
  PersonalPlanResult,
  PlanGender,
  PlanGoal,
  PlanPace,
  ProteinRange,
} from "../types/personalPlan";
import { calculateTargetCalories } from "./tdeeCalculator";

export const DISCLAIMER_HE =
  "החישוב הוא הערכה בלבד ואינו מהווה ייעוץ רפואי או תזונתי.";

const GOAL_LABEL: Record<PlanGoal, string> = {
  lose: "ירידה במשקל",
  maintain: "שמירה על המשקל",
  gain: "עלייה במשקל / בניית שריר",
};

const PACE_LABEL_LOSE: Record<PlanPace, string> = {
  slow: "ירידה איטית ונוחה",
  moderate: "ירידה מתונה (מומלץ)",
  aggressive: "ירידה מהירה",
};

const PACE_LABEL_GAIN: Record<PlanPace, string> = {
  slow: "עלייה רזה ואיטית",
  moderate: "עלייה מתונה",
  aggressive: "עלייה מהירה",
};

export function warningLowCalories(gender: PlanGender, min: number): string {
  const who = gender === "male" ? "לגברים" : "לנשים";
  return `היעד המחושב נמוך מ־${min} קלוריות ביום — רמה שעלולה להיות נמוכה מדי ${who}. מומלץ להתייעץ עם איש מקצוע לפני יישום.`;
}

export function warningAggressivePace(goal: PlanGoal): string {
  if (goal === "lose") {
    return "קצב ירידה אגרסיבי עלול להיות מאתגר מדי לחלק מהאנשים. עקבו אחרי אנרגיה, שינה והרגשה כללית.";
  }
  return "קצב עלייה מהיר עלול ללוות גם עלייה בשומן. שקלו קצב מתון יותר אם המטרה היא בעיקר שריר.";
}

export function buildGoalExplanation(
  answers: PersonalPlanAnswers,
  targetCalories: number,
  tdee: number
): string {
  const goal = GOAL_LABEL[answers.goal];
  if (answers.goal === "maintain") {
    return `למטרת ${goal}, הערכת התחזוקה היומית שלך היא כ־${tdee.toLocaleString("he-IL")} קלוריות. מומלץ לשאוף לכ־${targetCalories.toLocaleString("he-IL")} קלוריות ביום.`;
  }
  const pace =
    answers.goal === "lose"
      ? PACE_LABEL_LOSE[answers.pace ?? "moderate"]
      : PACE_LABEL_GAIN[answers.pace ?? "moderate"];
  return `למטרת ${goal} (${pace}), מומלץ להתחיל עם כ־${targetCalories.toLocaleString("he-IL")} קלוריות ביום, לעומת תחזוקה משוערת של כ־${tdee.toLocaleString("he-IL")} קלוריות.`;
}

export function buildPlanText(
  answers: PersonalPlanAnswers,
  targetCalories: number,
  protein: ProteinRange
): string {
  const cal = targetCalories.toLocaleString("he-IL");
  const prot = `${protein.minG}–${protein.maxG}`;

  if (answers.goal === "lose") {
    return `כדי לרדת במשקל בצורה מתונה, מומלץ להתחיל עם כ־${cal} קלוריות ביום, לשמור על חלבון גבוה (בערך ${prot} גרם), ולעקוב אחרי המשקל במשך 2–3 שבועות. אם אין שינוי, אפשר לבצע התאמה קטנה.`;
  }
  if (answers.goal === "gain") {
    return `לעלייה מבוקרת במשקל, שאפו לכ־${cal} קלוריות ביום עם חלבון של כ־${prot} גרם, תעדו ארוחות באפליקציה, ובדקו מגמה במשקל כל שבועיים.`;
  }
  return `לשמירה על המשקל, שאפו לכ־${cal} קלוריות ביום. חלבון מומלץ בערך ${prot} גרם. עקבו אחרי המשקל והתאימו בהדרגה אם יש סטייה ממגמה.`;
}

export interface PlanRecapItem {
  label: string;
  value: string;
}

/** "מה שסיפרת לנו" — תמצית התשובות בעברית. */
export function buildProfileRecap(answers: PersonalPlanAnswers): PlanRecapItem[] {
  const items: PlanRecapItem[] = [
    { label: "מין", value: PLAN_UI_LABELS.gender[answers.gender] },
    { label: "גיל", value: `${answers.age} שנים` },
    { label: "גובה", value: `${answers.heightCm} ס"מ` },
    { label: "משקל", value: `${answers.weightKg} ק"ג` },
    { label: "מטרה", value: PLAN_UI_LABELS.goal[answers.goal] },
  ];
  if (answers.goal !== "maintain" && answers.pace) {
    const paceLabel =
      answers.goal === "lose"
        ? PLAN_UI_LABELS.paceLose[answers.pace]
        : PLAN_UI_LABELS.paceGain[answers.pace];
    items.push({ label: "קצב", value: paceLabel });
  }
  items.push(
    { label: "אימונים", value: PLAN_UI_LABELS.training[answers.trainingFrequency] },
    { label: "אורח חיים", value: PLAN_UI_LABELS.lifestyle[answers.lifestyle] }
  );
  return items;
}

function paceDeltaLabel(goal: PlanGoal, pace: PlanPace | undefined): string {
  if (goal === "maintain") return "ללא שינוי — שמירה על תחזוקה";
  if (goal === "lose") {
    const d = { slow: 250, moderate: 500, aggressive: 750 }[pace ?? "moderate"];
    return `הפחתה של כ־${d} קלוריות מהתחזוקה`;
  }
  const d = { slow: 200, moderate: 350, aggressive: 500 }[pace ?? "moderate"];
  return `תוספת של כ־${d} קלוריות מעל התחזוקה`;
}

/** הסבר שלבי: למה יצא המספר הזה. */
export function buildCalculationSteps(
  answers: PersonalPlanAnswers,
  result: PersonalPlanResult
): string[] {
  const factor = result.activityFactor.toFixed(2);
  const steps = [
    `לפי הגיל (${answers.age}), הגובה (${answers.heightCm} ס"מ), המשקל (${answers.weightKg} ק"ג) והמין — חילוף החומרים הבסיסי שלך מוערך ב־${result.bmr.toLocaleString("he-IL")} קלוריות ביום.`,
    `בהתחשב ב־${PLAN_UI_LABELS.training[answers.trainingFrequency]} ובכך ש${PLAN_UI_LABELS.lifestyle[answers.lifestyle].toLowerCase()}, הערכת הפעילות היומית שלך (TDEE) היא כ־${result.tdee.toLocaleString("he-IL")} קלוריות (מקדם פעילות ×${factor}).`,
    `למטרת ${PLAN_UI_LABELS.goal[answers.goal]}: ${paceDeltaLabel(answers.goal, answers.pace)} → יעד מומלץ: ${result.targetCalories.toLocaleString("he-IL")} קלוריות ביום.`,
  ];
  const rawTarget = calculateTargetCalories(result.tdee, answers.goal, answers.pace);
  if (rawTarget !== result.targetCalories) {
    steps.push(
      `הערה: החישוב הגולמי היה ${rawTarget.toLocaleString("he-IL")} קלוריות; היעד המוצג מותאם לכללי בטיחות.`
    );
  }
  return steps;
}

/** Hebrew labels for UI selectors. */
export const PLAN_UI_LABELS = {
  gender: { male: "זכר", female: "נקבה" },
  goal: {
    lose: "ירידה במשקל",
    maintain: "שמירה על המשקל",
    gain: "עלייה במשקל / בניית שריר",
  },
  paceLose: {
    slow: "איטי ונוח — גירעון קטן",
    moderate: "מתון — מומלץ",
    aggressive: "אגרסיבי — גירעון גדול יותר",
  },
  paceGain: {
    slow: "עלייה רזה ואיטית",
    moderate: "עלייה מתונה",
    aggressive: "עלייה מהירה (עם סיכון לשומן)",
  },
  training: {
    "0": "0 אימונים בשבוע",
    "1_2": "1–2 אימונים בשבוע",
    "3_4": "3–4 אימונים בשבוע",
    "5_6": "5–6 אימונים בשבוע",
    "7_plus": "7+ אימונים בשבוע",
  },
  lifestyle: {
    sedentary: "בעיקר ישיבה",
    light_walk: "קצת הליכה / סידורים",
    standing: "עמידה או הליכה הרבה",
    physical_job: "עבודה פיזית",
  },
  preference: {
    calories_only: "קלוריות בלבד",
    calories_protein: "קלוריות + המלצת חלבון",
    full: "קלוריות + חלבון + טיפים כלליים",
  },
} as const;
