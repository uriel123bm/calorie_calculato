import type { PersonalPlanRecord } from "../types/personalPlan";

interface Props {
  plan: PersonalPlanRecord | null;
  currentTargetCalories?: number;
  onOpenQuestionnaire: () => void;
}

export function PersonalPlanCard({
  plan,
  currentTargetCalories,
  onOpenQuestionnaire,
}: Props) {
  if (!plan) {
    return (
      <section className="section personal-plan-card personal-plan-card--empty">
        <h2>
          <span className="material-symbols-outlined">target</span>
          התאמה אישית
        </h2>
        <p className="personal-plan-card-text">
          רוצה לדעת כמה קלוריות מתאים לך לאכול ביום?
        </p>
        <button type="button" className="primary personal-plan-card-btn" onClick={onOpenQuestionnaire}>
          מלא שאלון התאמה אישית
        </button>
      </section>
    );
  }

  const { result, answers } = plan;
  const showProtein =
    answers.preference === "calories_protein" || answers.preference === "full";

  return (
    <section className="section personal-plan-card">
      <h2>
        <span className="material-symbols-outlined">target</span>
        התוכנית האישית שלך
      </h2>
      <p className="personal-plan-card-highlight">
        היעד היומי שלך:{" "}
        <strong>{result.targetCalories.toLocaleString("he-IL")} קלוריות</strong>
      </p>
      {showProtein && (
        <p className="personal-plan-card-sub">
          המלצת חלבון: {result.protein.minG}–{result.protein.maxG} גרם ביום
        </p>
      )}
      {currentTargetCalories != null &&
        currentTargetCalories !== result.targetCalories && (
          <p className="personal-plan-card-note">
            יעד יומי נוכחי במעקב: {currentTargetCalories.toLocaleString("he-IL")} קלוריות
          </p>
        )}
      <button type="button" className="ghost personal-plan-card-btn" onClick={onOpenQuestionnaire}>
        עדכן את התוכנית שלי
      </button>
    </section>
  );
}
