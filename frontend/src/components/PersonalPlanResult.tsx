import type { PersonalPlanAnswers, PersonalPlanResult } from "../types/personalPlan";
import {
  buildCalculationSteps,
  buildProfileRecap,
} from "../utils/personalPlanCopy";

interface Props {
  answers: PersonalPlanAnswers;
  result: PersonalPlanResult;
  onClose: () => void;
  onRecalculate?: () => void;
  onGoToRecipes?: () => void;
}

export function PersonalPlanResultView({
  answers,
  result,
  onClose,
  onRecalculate,
  onGoToRecipes,
}: Props) {
  const showProtein =
    answers.preference === "calories_protein" || answers.preference === "full";
  const recap = buildProfileRecap(answers);
  const whySteps = buildCalculationSteps(answers, result);

  return (
    <div className="plan-result plan-result--celebrate">
      <div className="plan-result-hero">
        <span className="material-symbols-outlined plan-result-hero-icon" aria-hidden="true">
          celebration
        </span>
        <h2 className="plan-result-title">התוכנית האישית שלך מוכנה!</h2>
        <p className="plan-result-subtitle">
          היעד היומי שלך:{" "}
          <strong>{result.targetCalories.toLocaleString("he-IL")} קלוריות</strong>
        </p>
      </div>

      {result.warnings.length > 0 && (
        <div className="plan-warning-list" role="alert">
          {result.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}

      <section className="plan-result-section" aria-labelledby="plan-recap-heading">
        <h3 id="plan-recap-heading" className="plan-result-section-title">
          מה שסיפרת לנו
        </h3>
        <ul className="plan-recap-list">
          {recap.map((item) => (
            <li key={item.label}>
              <span className="plan-recap-label">{item.label}</span>
              <span className="plan-recap-value">{item.value}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="plan-result-section" aria-labelledby="plan-why-heading">
        <h3 id="plan-why-heading" className="plan-result-section-title">
          למה הגענו למספר הזה?
        </h3>
        <ol className="plan-why-steps">
          {whySteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <div className="plan-result-grid">
        <div className="plan-result-stat">
          <span className="plan-result-label">חילוף חומרים בסיסי (BMR)</span>
          <span className="plan-result-value">{result.bmr.toLocaleString("he-IL")}</span>
          <span className="plan-result-unit">קלוריות/יום</span>
        </div>
        <div className="plan-result-stat">
          <span className="plan-result-label">תחזוקה יומית משוערת (TDEE)</span>
          <span className="plan-result-value">{result.tdee.toLocaleString("he-IL")}</span>
          <span className="plan-result-unit">קלוריות/יום</span>
        </div>
        <div className="plan-result-stat plan-result-stat--primary">
          <span className="plan-result-label">המלצת קלוריות יומית</span>
          <span className="plan-result-value">{result.targetCalories.toLocaleString("he-IL")}</span>
          <span className="plan-result-unit">קלוריות/יום</span>
        </div>
        {showProtein && (
          <div className="plan-result-stat">
            <span className="plan-result-label">המלצת חלבון</span>
            <span className="plan-result-value">
              {result.protein.minG}–{result.protein.maxG}
            </span>
            <span className="plan-result-unit">גרם ביום</span>
          </div>
        )}
      </div>

      <p className="plan-result-explanation">{result.goalExplanationHe}</p>

      <div className="plan-result-plan-box">
        <h3>תוכנית התחלה</h3>
        <p>{result.planTextHe}</p>
      </div>

      <p className="plan-result-disclaimer">{result.disclaimerHe}</p>

      <div className="plan-wizard-actions plan-wizard-actions--result">
        <button type="button" className="primary" onClick={onClose}>
          מעולה, התחל לעקוב
        </button>
        {onGoToRecipes && (
          <button type="button" className="ghost" onClick={onGoToRecipes}>
            התחל לחשב מתכונים
          </button>
        )}
        {onRecalculate && (
          <button type="button" className="ghost" onClick={onRecalculate}>
            חשב מחדש
          </button>
        )}
      </div>
    </div>
  );
}
