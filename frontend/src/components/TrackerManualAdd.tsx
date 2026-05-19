import { useCallback, useEffect, useId, useRef, useState } from "react";
import { isCancel } from "axios";
import { NUTRITION_SOURCE_BADGES } from "../constants/nutritionSourceBadges";
import { analyzeIngredient } from "../services/api";
import type {
  DailyEntryInput,
  HebrewUnit,
  MealType,
  NutritionSource,
  UserProduct,
} from "../types";
import { MEAL_TYPE_ICONS, MEAL_TYPE_LABELS, UNITS } from "../types";
import {
  findPersonalProductByName,
  normalizeProductLabel,
  totalsForProductQuantity,
} from "../utils/personalProductMatch";
import { roundCalories, roundMacro } from "../utils/nutritionRounding";
import { isOfflineError } from "../utils/network";
import { PersonalProductChips } from "./PersonalProductChips";

interface DetectedMacros {
  calories: number;
  carbohydrates: number;
  fat: number;
}

interface Props {
  onAdd: (input: DailyEntryInput) => void;
  personalProducts?: UserProduct[];
  /** כפתור שמירה — למשל "הוסף ליום" / "הוסף ליום זה" */
  submitLabel?: string;
  /** כותרת משנה מעל הטופס */
  hint?: string;
}

/**
 * הוספה ידנית ליומן — שם, כמות, יחידה, זיהוי אוטומטי ומוצרים אישיים (כמו בדף הבית).
 */
export function TrackerManualAdd({
  onAdd,
  personalProducts = [],
  submitLabel = "הוסף ליום",
  hint,
}: Props) {
  const [mName, setMName] = useState("");
  const [mQty, setMQty] = useState<number | "">(100);
  const [mUnit, setMUnit] = useState<HebrewUnit>("גרם");
  const [mMealType, setMMealType] = useState<MealType | undefined>(undefined);
  const [mCalories, setMCalories] = useState<number | "">("");
  const [mProtein, setMProtein] = useState<number | "">("");
  const [mDetected, setMDetected] = useState<DetectedMacros | null>(null);
  const [mAnalyzeMeta, setMAnalyzeMeta] = useState<{
    source: NutritionSource;
    confidence: number;
    matchedName: string | null;
  } | null>(null);
  const [mStatus, setMStatus] = useState<"idle" | "loading" | "ready" | "error" | "none">("idle");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const manualProductsListId = useId().replace(/:/g, "");
  const matchedPersonalRef = useRef<UserProduct | null>(null);
  const manualFieldsRef = useRef({
    name: "",
    qty: 100 as number | "",
    unit: "גרם" as HebrewUnit,
  });
  const manualEpochRef = useRef(0);
  const manualDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualAbortRef = useRef<AbortController | null>(null);
  const MANUAL_DEBOUNCE_MS = 420;

  useEffect(() => {
    manualFieldsRef.current = { name: mName, qty: mQty, unit: mUnit };
  }, [mName, mQty, mUnit]);

  useEffect(() => {
    return () => {
      if (manualDebounceRef.current) clearTimeout(manualDebounceRef.current);
      manualAbortRef.current?.abort();
    };
  }, []);

  const flash = useCallback((msg: string) => {
    setStatusMsg(msg);
    window.setTimeout(() => setStatusMsg(null), 2200);
  }, []);

  const applyPersonalProductFill = (p: UserProduct) => {
    matchedPersonalRef.current = p;
    const qty = 1;
    setMName(p.name);
    setMQty(qty);
    setMUnit("יחידה");
    const m = totalsForProductQuantity(p, qty);
    setMCalories(roundCalories(m.calories));
    setMProtein(roundMacro(m.protein));
    setMDetected({
      calories: m.calories,
      carbohydrates: m.carbohydrates,
      fat: m.fat,
    });
    setMAnalyzeMeta({
      source: "personal_library",
      confidence: 1,
      matchedName: p.name,
    });
    setMStatus("ready");
  };

  const runIngredientAnalyze = useCallback(async () => {
    const { name: rawName, qty: rawQty, unit } = manualFieldsRef.current;
    const name = rawName.trim();
    const qty = typeof rawQty === "number" ? rawQty : 0;
    if (!name || qty <= 0) return;
    matchedPersonalRef.current = null;
    const epoch = ++manualEpochRef.current;
    const ac = new AbortController();
    manualAbortRef.current = ac;
    setMStatus("loading");
    setMAnalyzeMeta(null);
    try {
      const res = await analyzeIngredient(
        { ingredient_name: name, quantity: qty, unit },
        { signal: ac.signal }
      );
      if (epoch !== manualEpochRef.current) return;
      const found = res.source !== "ai_estimate" && res.confidence > 0.4;
      const macros = res.nutrition_for_quantity;
      setMCalories(roundCalories(macros.calories));
      setMProtein(roundMacro(macros.protein));
      setMAnalyzeMeta({
        source: res.source,
        confidence: res.confidence,
        matchedName: res.matched_name,
      });
      setMDetected({
        calories: macros.calories,
        carbohydrates: macros.carbohydrates,
        fat: macros.fat,
      });
      setMStatus(found ? "ready" : "none");
    } catch (e: unknown) {
      if (epoch !== manualEpochRef.current) return;
      if (isCancel(e)) return;
      setMDetected(null);
      setMAnalyzeMeta(null);
      setMStatus("error");
      if (isOfflineError(e)) flash(e.message);
    }
  }, [flash]);

  const scheduleIngredientAnalyze = useCallback(() => {
    if (manualDebounceRef.current) clearTimeout(manualDebounceRef.current);
    manualAbortRef.current?.abort();
    manualDebounceRef.current = setTimeout(() => {
      manualDebounceRef.current = null;
      void runIngredientAnalyze();
    }, MANUAL_DEBOUNCE_MS);
  }, [runIngredientAnalyze]);

  const handleManualNameBlur = () => {
    const trimmed = mName.trim();
    if (!trimmed) return;
    const hit = findPersonalProductByName(trimmed, personalProducts);
    if (hit) {
      applyPersonalProductFill(hit);
      return;
    }
    matchedPersonalRef.current = null;
    const qty = typeof mQty === "number" ? mQty : 0;
    if (qty > 0) scheduleIngredientAnalyze();
  };

  const handleManualQtyBlur = () => {
    const name = mName.trim();
    const qty = typeof mQty === "number" ? mQty : 0;
    const bound = matchedPersonalRef.current;
    if (
      bound &&
      findPersonalProductByName(name, personalProducts)?.id === bound.id &&
      qty > 0
    ) {
      const m = totalsForProductQuantity(bound, qty);
      setMCalories(roundCalories(m.calories));
      setMProtein(roundMacro(m.protein));
      setMDetected({
        calories: m.calories,
        carbohydrates: m.carbohydrates,
        fat: m.fat,
      });
      setMAnalyzeMeta({
        source: "personal_library",
        confidence: 1,
        matchedName: bound.name,
      });
      setMStatus("ready");
      return;
    }
    scheduleIngredientAnalyze();
  };

  const handleManualUnitBlur = () => {
    matchedPersonalRef.current = null;
    scheduleIngredientAnalyze();
  };

  const handleManualAdd = () => {
    const cals = typeof mCalories === "number" ? mCalories : 0;
    if (!mName.trim() || cals <= 0) return;

    let carbs = 0;
    let fat = 0;
    if (mDetected && mDetected.calories > 0) {
      const factor = cals / mDetected.calories;
      carbs = roundMacro(mDetected.carbohydrates * factor);
      fat = roundMacro(mDetected.fat * factor);
    }

    matchedPersonalRef.current = null;
    onAdd({
      name: mName.trim(),
      calories: roundCalories(cals),
      protein: roundMacro(typeof mProtein === "number" ? mProtein : 0),
      carbohydrates: carbs,
      fat,
      mealType: mMealType,
    });
    setMName("");
    setMQty(100);
    setMUnit("גרם");
    setMCalories("");
    setMProtein("");
    setMDetected(null);
    setMAnalyzeMeta(null);
    setMStatus("idle");
  };

  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "BUTTON" || tag === "SELECT") return;
    e.preventDefault();
    handleManualAdd();
  };

  const defaultHint =
    personalProducts.length > 0
      ? "בשם הפריט אפשר לכתוב מוצר מהספרייה — יוטען עם הערכים ששמרת. אחרת המערכת תזהה אוטומטית."
      : "רשום שם וכמות — המערכת תזהה קלוריות וחלבון. ניתן לתקן לפני הוספה.";

  return (
    <div className="section tracker-manual-add-section" onKeyDown={handleFormKeyDown}>
      <h2>
        <span className="material-symbols-outlined">add_circle</span>
        הוסף ערך ידני
      </h2>
      <p className="tracker-manual-hint">{hint ?? defaultHint}</p>
      {personalProducts.length > 0 && (
        <PersonalProductChips
          products={personalProducts}
          onPick={applyPersonalProductFill}
          title="מילוי מהיר"
        />
      )}
      <div className="tracker-manual-grid">
        <div className="manual-field manual-field--name">
          <label className="manual-field-label" htmlFor={`${manualProductsListId}-name`}>
            שם הפריט
          </label>
          <input
            id={`${manualProductsListId}-name`}
            className="manual-input manual-name"
            type="text"
            placeholder={
              personalProducts.length > 0
                ? "הקלידו מוצר מהספרייה או כל מזון…"
                : "למשל תפוח, יוגורט, חזה עוף…"
            }
            list={personalProducts.length > 0 ? manualProductsListId : undefined}
            value={mName}
            onChange={(e) => {
              const v = e.target.value;
              setMName(v);
              const b = matchedPersonalRef.current;
              if (b && normalizeProductLabel(v) !== normalizeProductLabel(b.name)) {
                matchedPersonalRef.current = null;
              }
              setMDetected(null);
              setMAnalyzeMeta(null);
              if (mStatus !== "idle") setMStatus("idle");
            }}
            onBlur={handleManualNameBlur}
          />
        </div>

        <div className="manual-field manual-field--qty">
          <label className="manual-field-label" htmlFor={`${manualProductsListId}-qty`}>
            כמות
          </label>
          <input
            id={`${manualProductsListId}-qty`}
            className="manual-input manual-qty"
            type="number"
            min={0}
            step="any"
            placeholder="מספר"
            value={mQty === "" ? "" : mQty}
            onChange={(e) => {
              const v = e.target.value;
              setMQty(v === "" ? "" : Math.max(0, Number(v)));
              setMDetected(null);
              setMAnalyzeMeta(null);
              if (mStatus !== "idle") setMStatus("idle");
            }}
            onBlur={handleManualQtyBlur}
          />
        </div>

        <div className="manual-field manual-field--unit">
          <span className="manual-field-label" id={`${manualProductsListId}-unit-cap`}>
            יחידת מידה
          </span>
          <div className="manual-select-shell">
            <select
              id={`${manualProductsListId}-unit`}
              className="manual-unit-select-native"
              aria-labelledby={`${manualProductsListId}-unit-cap`}
              value={mUnit}
              onChange={(e) => {
                matchedPersonalRef.current = null;
                setMUnit(e.target.value as HebrewUnit);
                setMDetected(null);
                setMAnalyzeMeta(null);
                if (mStatus !== "idle") setMStatus("idle");
              }}
              onBlur={handleManualUnitBlur}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <span className="manual-select-chevron-deco" aria-hidden="true">
              <span className="material-symbols-outlined manual-select-chevron-icon">
                expand_more
              </span>
            </span>
          </div>
        </div>

        <div className="manual-field manual-field--cal">
          <label className="manual-field-label" htmlFor={`${manualProductsListId}-cal`}>
            קלוריות
          </label>
          <input
            id={`${manualProductsListId}-cal`}
            className="manual-input manual-cal"
            type="number"
            min={0}
            step="1"
            value={mCalories === "" ? "" : mCalories}
            onChange={(e) => {
              const v = e.target.value;
              setMCalories(v === "" ? "" : Math.max(0, Number(v)));
            }}
          />
        </div>

        <div className="manual-field manual-field--protein">
          <label className="manual-field-label" htmlFor={`${manualProductsListId}-protein`}>
            חלבון (גרם)
          </label>
          <input
            id={`${manualProductsListId}-protein`}
            className="manual-input manual-protein"
            type="number"
            min={0}
            step="0.1"
            value={mProtein === "" ? "" : mProtein}
            onChange={(e) => {
              const v = e.target.value;
              setMProtein(v === "" ? "" : Math.max(0, Number(v)));
            }}
          />
        </div>
      </div>

      {personalProducts.length > 0 && (
        <datalist id={manualProductsListId}>
          {personalProducts.map((p) => (
            <option key={p.id} value={p.name} />
          ))}
        </datalist>
      )}

      <div className="meal-type-selector" role="group" aria-label="סוג ארוחה">
        {(["breakfast", "lunch", "dinner", "snack"] as MealType[]).map((mt) => (
          <button
            key={mt}
            type="button"
            className={`meal-type-pill${mMealType === mt ? " active" : ""}`}
            onClick={() => setMMealType((prev) => (prev === mt ? undefined : mt))}
            aria-pressed={mMealType === mt}
          >
            <span className="material-symbols-outlined">{MEAL_TYPE_ICONS[mt]}</span>
            {MEAL_TYPE_LABELS[mt]}
          </button>
        ))}
      </div>

      {(mStatus === "ready" || mStatus === "none") && mAnalyzeMeta && (
        <div className="manual-analyze-meta" aria-live="polite">
          <span
            className={`badge ${NUTRITION_SOURCE_BADGES[mAnalyzeMeta.source]?.cls ?? "unknown"}`}
          >
            {NUTRITION_SOURCE_BADGES[mAnalyzeMeta.source]?.label ?? mAnalyzeMeta.source}
          </span>
          {mAnalyzeMeta.source !== "personal_library" &&
            mAnalyzeMeta.source !== "local" &&
            mAnalyzeMeta.confidence > 0 && (
              <span className="manual-analyze-confidence">
                ביטחון {Math.round(mAnalyzeMeta.confidence * 100)}%
              </span>
            )}
          {mAnalyzeMeta.matchedName && mAnalyzeMeta.matchedName.trim() !== mName.trim() && (
            <span className="manual-analyze-matched">← {mAnalyzeMeta.matchedName}</span>
          )}
        </div>
      )}

      <div className="tracker-manual-actions">
        <span className={`manual-status ${mStatus}`}>
          {statusMsg ||
            (mStatus === "loading"
              ? "מזהה..."
              : mStatus === "ready"
                ? "✓ ערכים זוהו — ניתן לערוך"
                : mStatus === "none"
                  ? "⚠ לא נמצא — מלאו ידנית"
                  : mStatus === "error"
                    ? "✕ שגיאה — מלאו ידנית"
                    : " ")}
        </span>
        <button
          type="button"
          className="primary"
          onClick={handleManualAdd}
          disabled={
            !mName.trim() ||
            mCalories === "" ||
            (typeof mCalories === "number" && mCalories <= 0)
          }
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
