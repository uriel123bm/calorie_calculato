import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BodyMetrics } from "../types";
import type {
  LifestyleActivity,
  PersonalPlanAnswers,
  PersonalPlanResult,
  PlanGender,
  PlanGoal,
  PlanPace,
  PlanPreference,
  TrainingFrequency,
} from "../types/personalPlan";
import { PLAN_UI_LABELS } from "../utils/personalPlanCopy";
import { buildInitialAnswers } from "../utils/personalPlanPrefill";
import { buildPlanResult, PLAN_VALIDATION } from "../utils/tdeeCalculator";
import { PersonalPlanResultView } from "./PersonalPlanResult";

type WizardPhase = "intro" | 1 | 2 | 3 | 4 | "result";

interface Props {
  open: boolean;
  onClose: () => void;
  existingPlan?: PersonalPlanAnswers | null;
  bodyMetrics?: BodyMetrics | null;
  onComplete: (answers: PersonalPlanAnswers, result: PersonalPlanResult) => void;
  onGoToRecipes?: () => void;
}

const TRAINING_KEYS = Object.keys(PLAN_UI_LABELS.training) as TrainingFrequency[];
const LIFESTYLE_KEYS = Object.keys(PLAN_UI_LABELS.lifestyle) as LifestyleActivity[];
const PREFERENCE_KEYS = Object.keys(PLAN_UI_LABELS.preference) as PlanPreference[];

function ChoiceGrid<T extends string>({
  options,
  labels,
  value,
  onChange,
}: {
  options: readonly T[];
  labels: Record<T, string>;
  value: T | "";
  onChange: (v: T) => void;
}) {
  return (
    <div className="plan-choice-grid" role="radiogroup">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          role="radio"
          aria-checked={value === opt}
          className={`plan-choice${value === opt ? " active" : ""}`}
          onClick={() => onChange(opt)}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}

export function PersonalPlanQuestionnaire({
  open,
  onClose,
  existingPlan,
  bodyMetrics,
  onComplete,
  onGoToRecipes,
}: Props) {
  const prefill = useMemo(
    () => buildInitialAnswers(existingPlan ?? null, bodyMetrics ?? null),
    [existingPlan, bodyMetrics]
  );

  const [phase, setPhase] = useState<WizardPhase>("intro");
  const [error, setError] = useState("");

  const [gender, setGender] = useState<PlanGender | "">(prefill.gender ?? "");
  const [age, setAge] = useState<number | "">(prefill.age ?? "");
  const [heightCm, setHeightCm] = useState<number | "">(prefill.heightCm ?? "");
  const [weightKg, setWeightKg] = useState<number | "">(prefill.weightKg ?? "");
  const [goal, setGoal] = useState<PlanGoal | "">(prefill.goal ?? "");
  const [pace, setPace] = useState<PlanPace | "">(prefill.pace ?? "moderate");
  const [trainingFrequency, setTrainingFrequency] = useState<TrainingFrequency | "">(
    prefill.trainingFrequency ?? ""
  );
  const [lifestyle, setLifestyle] = useState<LifestyleActivity | "">(
    prefill.lifestyle ?? ""
  );
  const [preference, setPreference] = useState<PlanPreference | "">(
    prefill.preference ?? "calories_protein"
  );

  const [result, setResult] = useState<PersonalPlanResult | null>(null);
  const [finalAnswers, setFinalAnswers] = useState<PersonalPlanAnswers | null>(null);
  const [applied, setApplied] = useState(false);
  const wasOpenRef = useRef(false);

  const resetForm = useCallback(() => {
    const p = buildInitialAnswers(existingPlan ?? null, bodyMetrics ?? null);
    setGender(p.gender ?? "");
    setAge(p.age ?? "");
    setHeightCm(p.heightCm ?? "");
    setWeightKg(p.weightKg ?? "");
    setGoal(p.goal ?? "");
    setPace(p.pace ?? "moderate");
    setTrainingFrequency(p.trainingFrequency ?? "");
    setLifestyle(p.lifestyle ?? "");
    setPreference(p.preference ?? "calories_protein");
    setError("");
    setResult(null);
    setFinalAnswers(null);
    setApplied(false);
  }, [existingPlan, bodyMetrics]);

  /** Reset only when the wizard opens — not when existingPlan updates after save. */
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      resetForm();
      setPhase(existingPlan ? 1 : "intro");
    }
    if (!open) {
      wasOpenRef.current = false;
    } else {
      wasOpenRef.current = true;
    }
  }, [open, existingPlan, resetForm]);

  if (!open) return null;

  const numericChange =
    (setter: (v: number | "") => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === "") return setter("");
      const num = Number(raw.replace(",", "."));
      if (Number.isFinite(num)) setter(num);
    };

  const validateStep = (step: WizardPhase): boolean => {
    setError("");
    if (step === 1) {
      if (!gender) {
        setError("בחרו מין.");
        return false;
      }
      const a = typeof age === "number" ? age : 0;
      if (a < PLAN_VALIDATION.ageMin || a > PLAN_VALIDATION.ageMax) {
        setError(`גיל חייב להיות בין ${PLAN_VALIDATION.ageMin} ל-${PLAN_VALIDATION.ageMax}.`);
        return false;
      }
    }
    if (step === 2) {
      const h = typeof heightCm === "number" ? heightCm : 0;
      const w = typeof weightKg === "number" ? weightKg : 0;
      if (h < PLAN_VALIDATION.heightMin || h > PLAN_VALIDATION.heightMax) {
        setError(`גובה חייב להיות בין ${PLAN_VALIDATION.heightMin} ל-${PLAN_VALIDATION.heightMax} ס"מ.`);
        return false;
      }
      if (w < PLAN_VALIDATION.weightMin || w > PLAN_VALIDATION.weightMax) {
        setError(`משקל חייב להיות בין ${PLAN_VALIDATION.weightMin} ל-${PLAN_VALIDATION.weightMax} ק"ג.`);
        return false;
      }
    }
    if (step === 3) {
      if (!goal) {
        setError("בחרו מטרה.");
        return false;
      }
      if ((goal === "lose" || goal === "gain") && !pace) {
        setError("בחרו קצב.");
        return false;
      }
    }
    if (step === 4) {
      if (!trainingFrequency || !lifestyle || !preference) {
        setError("מלאו את כל השדות.");
        return false;
      }
    }
    return true;
  };

  const goNext = () => {
    if (phase === "intro") {
      setPhase(1);
      return;
    }
    if (typeof phase === "number") {
      if (!validateStep(phase)) return;
      if (phase < 4) {
        setPhase((phase + 1) as WizardPhase);
        return;
      }
      submitCalculation();
    }
  };

  const goBack = () => {
    setError("");
    if (phase === "result") {
      setPhase(4);
      return;
    }
    if (phase === 1) {
      setPhase("intro");
      return;
    }
    if (typeof phase === "number" && phase > 1) {
      setPhase((phase - 1) as WizardPhase);
    }
  };

  const submitCalculation = () => {
    if (!validateStep(4)) return;
    const answers: PersonalPlanAnswers = {
      gender: gender as PlanGender,
      age: age as number,
      heightCm: heightCm as number,
      weightKg: weightKg as number,
      goal: goal as PlanGoal,
      pace: goal === "maintain" ? undefined : (pace as PlanPace),
      trainingFrequency: trainingFrequency as TrainingFrequency,
      lifestyle: lifestyle as LifestyleActivity,
      preference: preference as PlanPreference,
    };
    const computed = buildPlanResult(answers);
    setFinalAnswers(answers);
    setResult(computed);
    setApplied(false);
    setPhase("result");
    requestAnimationFrame(() => {
      document.querySelector(".plan-wizard-card")?.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const finishAndClose = () => {
    if (finalAnswers && result && !applied) {
      onComplete(finalAnswers, result);
      setApplied(true);
    }
    onClose();
  };

  const handleWizardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    const target = e.target as HTMLElement;
    if (target.tagName === "TEXTAREA") return;
    if (phase === "result") {
      e.preventDefault();
      finishAndClose();
      return;
    }
    if (target.tagName === "BUTTON" && phase !== "intro") return;
    e.preventDefault();
    goNext();
  };

  const paceLabels =
    goal === "gain" ? PLAN_UI_LABELS.paceGain : PLAN_UI_LABELS.paceLose;
  const paceKeys = Object.keys(paceLabels) as PlanPace[];

  return (
    <div
      className="onboarding-overlay plan-wizard-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="שאלון התאמה אישית"
    >
      <div
        className="onboarding-card plan-wizard-card"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleWizardKeyDown}
      >
        <div className="onboarding-head">
          {phase !== "intro" && phase !== "result" && (
            <span className="plan-step-badge">שלב {phase} מתוך 4</span>
          )}
          {phase === "result" && (
            <span className="plan-step-badge plan-step-badge--done">סיכום התוכנית</span>
          )}
          {phase !== "result" && (
            <button type="button" className="ghost onboarding-close" onClick={onClose}>
              סגור
            </button>
          )}
        </div>

        {phase === "intro" && (
          <div className="plan-step">
            <h2 className="plan-intro-title">בוא נתאים לך יעד קלורי אישי</h2>
            <p className="onboarding-text">
              ענה על כמה שאלות קצרות ונחשב לך הערכה יומית לפי המטרה שלך.
              <br />
              <small className="plan-enter-hint">Enter להמשך · Enter במסך הסיכום לסיום</small>
            </p>
            <div className="plan-wizard-actions">
              <button type="button" className="primary" onClick={goNext}>
                התחל שאלון
              </button>
            </div>
          </div>
        )}

        {phase === 1 && (
          <div className="plan-step">
            <h3 className="plan-step-title">פרטים בסיסיים</h3>
            <fieldset className="plan-fieldset">
              <legend>מין</legend>
              <ChoiceGrid
                options={["male", "female"] as const}
                labels={PLAN_UI_LABELS.gender}
                value={gender}
                onChange={setGender}
              />
            </fieldset>
            <label className="product-form-label">
              גיל
              <input
                type="number"
                inputMode="numeric"
                min={PLAN_VALIDATION.ageMin}
                max={PLAN_VALIDATION.ageMax}
                value={age === "" ? "" : age}
                onChange={numericChange(setAge)}
              />
            </label>
          </div>
        )}

        {phase === 2 && (
          <div className="plan-step">
            <h3 className="plan-step-title">מידות גוף</h3>
            <div className="product-form-row product-form-grid">
              <label className="product-form-label">
                גובה (ס"מ)
                <input
                  type="number"
                  inputMode="numeric"
                  min={PLAN_VALIDATION.heightMin}
                  max={PLAN_VALIDATION.heightMax}
                  value={heightCm === "" ? "" : heightCm}
                  onChange={numericChange(setHeightCm)}
                />
              </label>
              <label className="product-form-label">
                משקל (ק"ג)
                <input
                  type="number"
                  inputMode="decimal"
                  min={PLAN_VALIDATION.weightMin}
                  max={PLAN_VALIDATION.weightMax}
                  step="0.1"
                  value={weightKg === "" ? "" : weightKg}
                  onChange={numericChange(setWeightKg)}
                />
              </label>
            </div>
          </div>
        )}

        {phase === 3 && (
          <div className="plan-step">
            <h3 className="plan-step-title">המטרה שלך</h3>
            <fieldset className="plan-fieldset">
              <legend>מטרה</legend>
              <ChoiceGrid
                options={["lose", "maintain", "gain"] as const}
                labels={PLAN_UI_LABELS.goal}
                value={goal}
                onChange={(g) => {
                  setGoal(g);
                  if (g === "maintain") setPace("");
                  else if (!pace) setPace("moderate");
                }}
              />
            </fieldset>
            {(goal === "lose" || goal === "gain") && (
              <fieldset className="plan-fieldset">
                <legend>קצב</legend>
                <ChoiceGrid
                  options={paceKeys}
                  labels={paceLabels}
                  value={pace}
                  onChange={setPace}
                />
                {pace === "aggressive" && (
                  <p className="plan-inline-warning" role="note">
                    קצב אגרסיבי — מומלץ לעקוב אחרי ההרגשה ולהתייעץ במידת הצורך.
                  </p>
                )}
              </fieldset>
            )}
          </div>
        )}

        {phase === 4 && (
          <div className="plan-step">
            <h3 className="plan-step-title">פעילות יומית</h3>
            <fieldset className="plan-fieldset">
              <legend>תדירות אימונים</legend>
              <ChoiceGrid
                options={TRAINING_KEYS}
                labels={PLAN_UI_LABELS.training}
                value={trainingFrequency}
                onChange={setTrainingFrequency}
              />
            </fieldset>
            <fieldset className="plan-fieldset">
              <legend>אורח חיים יומי</legend>
              <ChoiceGrid
                options={LIFESTYLE_KEYS}
                labels={PLAN_UI_LABELS.lifestyle}
                value={lifestyle}
                onChange={setLifestyle}
              />
            </fieldset>
            <fieldset className="plan-fieldset">
              <legend>מה תרצו לראות בתוצאה?</legend>
              <ChoiceGrid
                options={PREFERENCE_KEYS}
                labels={PLAN_UI_LABELS.preference}
                value={preference}
                onChange={setPreference}
              />
            </fieldset>
          </div>
        )}

        {phase === "result" && result && finalAnswers && (
          <PersonalPlanResultView
            answers={finalAnswers}
            result={result}
            onClose={finishAndClose}
            onRecalculate={() => {
              setPhase(1);
              setResult(null);
              setFinalAnswers(null);
              setApplied(false);
            }}
            onGoToRecipes={() => {
              if (finalAnswers && result && !applied) {
                onComplete(finalAnswers, result);
                setApplied(true);
              }
              onGoToRecipes?.();
              onClose();
            }}
          />
        )}

        {error && <p className="plan-error" role="alert">{error}</p>}

        {phase !== "intro" && phase !== "result" && (
          <div className="plan-wizard-actions">
            <button type="button" className="ghost" onClick={goBack}>
              חזור
            </button>
            <button type="button" className="primary" onClick={goNext}>
              {phase === 4 ? "חשב לי יעד יומי" : "המשך"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
