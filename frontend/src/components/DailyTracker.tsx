import { useMemo, useState } from "react";
import { analyzeIngredient } from "../services/api";
import type {
  DailyEntryInput,
  DailyTrackerState,
  HebrewUnit,
} from "../types";
import { UNITS } from "../types";

interface Props {
  state: DailyTrackerState;
  setTarget: (target: number) => void;
  addEntry: (input: DailyEntryInput) => void;
  removeEntry: (id: string) => void;
  resetDay: () => void;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function DailyTracker({ state, setTarget, addEntry, removeEntry, resetDay }: Props) {
  // Manual entry state
  const [mName, setMName] = useState("");
  const [mQty, setMQty] = useState<number | "">(100);
  const [mUnit, setMUnit] = useState<HebrewUnit>("גרם");
  const [mCalories, setMCalories] = useState<number | "">("");
  const [mProtein, setMProtein] = useState<number | "">("");
  const [mStatus, setMStatus] = useState<"idle" | "loading" | "ready" | "error" | "none">("idle");

  const totals = useMemo(() => state.entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbohydrates: acc.carbohydrates + e.carbohydrates,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbohydrates: 0, fat: 0 }
  ), [state.entries]);

  const remaining = state.targetCalories - totals.calories;
  const overshoot = remaining < 0;
  const progressPct = Math.min(100, state.targetCalories > 0
    ? (totals.calories / state.targetCalories) * 100 : 0);

  const runManualAnalyze = async () => {
    const name = mName.trim();
    const qty = typeof mQty === "number" ? mQty : 0;
    if (!name || qty <= 0) return;
    setMStatus("loading");
    try {
      const res = await analyzeIngredient({ ingredient_name: name, quantity: qty, unit: mUnit });
      const found = res.source !== "ai_estimate" && res.confidence > 0.4;
      setMCalories(Math.round(res.nutrition_for_quantity.calories));
      setMProtein(round1(res.nutrition_for_quantity.protein));
      setMStatus(found ? "ready" : "none");
    } catch {
      setMStatus("error");
    }
  };

  const handleManualAdd = () => {
    const cals = typeof mCalories === "number" ? mCalories : 0;
    if (!mName.trim() || cals <= 0) return;
    addEntry({
      name: mName.trim(),
      calories: cals,
      protein: typeof mProtein === "number" ? mProtein : 0,
    });
    setMName(""); setMQty(100); setMUnit("גרם");
    setMCalories(""); setMProtein(""); setMStatus("idle");
  };

  const handleResetDay = () => {
    if (state.entries.length === 0) return;
    const ok = window.confirm("לאפס את כל הרשומות של היום?");
    if (!ok) return;
    resetDay();
  };

  return (
    <div className="page-container">
      {/* Page hero */}
      <div className="page-hero">
        <span className="material-symbols-outlined page-hero-icon">monitoring</span>
        <div>
          <h2 className="page-title">קלוריות היומיות</h2>
          <p className="page-subtitle">עקוב אחרי מה שאכלת היום</p>
        </div>
      </div>

      {/* Target input */}
      <div className="section">
        <div className="target-row">
          <label htmlFor="daily-target">יעד יומי (קק"ל):</label>
          <input
            id="daily-target"
            type="number"
            min={0}
            step={50}
            value={state.targetCalories}
            onChange={(e) => setTarget(Number(e.target.value))}
          />
        </div>

        {/* Circular ring */}
        {(() => {
          const R = 42;
          const CIRC = 2 * Math.PI * R;
          const offset = CIRC * (1 - Math.min(progressPct / 100, 1));
          return (
            <div className="tracker-ring-wrap">
              <div style={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
                <svg className="progress-ring-svg" viewBox="0 0 100 100">
                  <circle className="progress-ring-bg" cx="50" cy="50" r={R} strokeWidth="7" />
                  <circle
                    className={`progress-ring-fill${overshoot ? " over" : ""}`}
                    cx="50" cy="50" r={R}
                    strokeWidth="7"
                    strokeDasharray={`${CIRC}`}
                    strokeDashoffset={`${offset}`}
                  />
                </svg>
                <div className="ring-inner">
                  <span className={`ring-calories${overshoot ? " over" : ""}`}>
                    {Math.abs(Math.round(remaining))}
                  </span>
                  <span className="ring-label">
                    {overshoot ? 'חרגת (קק"ל)' : 'נותרו (קק"ל)'}
                  </span>
                </div>
              </div>
              <div className="ring-stats">
                <div style={{ textAlign: "center", padding: "0 8px" }}>
                  <div className="ring-stat-label">יעד</div>
                  <div className="ring-stat-value">{state.targetCalories.toLocaleString()}</div>
                </div>
                <div className="divider" />
                <div style={{ textAlign: "center", padding: "0 8px" }}>
                  <div className="ring-stat-label">נצרך</div>
                  <div className="ring-stat-value primary">{Math.round(totals.calories).toLocaleString()}</div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Macros bento */}
        <div className="macro-bento">
          <div className="macro-tile protein">
            <span className="material-symbols-outlined macro-icon">egg</span>
            <span className="macro-label">חלבון</span>
            <div className="progress-bar"><div className="progress-fill green" style={{ width: `${Math.min(100, (totals.protein / 120) * 100)}%` }} /></div>
            <span className="macro-value">{totals.protein.toFixed(0)}ג</span>
          </div>
          <div className="macro-tile carbs">
            <span className="material-symbols-outlined macro-icon">bakery_dining</span>
            <span className="macro-label">פחמימות</span>
            <div className="progress-bar"><div className="progress-fill orange" style={{ width: `${Math.min(100, (totals.carbohydrates / 250) * 100)}%` }} /></div>
            <span className="macro-value">{totals.carbohydrates.toFixed(0)}ג</span>
          </div>
          <div className="macro-tile fat">
            <span className="material-symbols-outlined macro-icon">opacity</span>
            <span className="macro-label">שומן</span>
            <div className="progress-bar"><div className="progress-fill teal" style={{ width: `${Math.min(100, (totals.fat / 70) * 100)}%` }} /></div>
            <span className="macro-value">{totals.fat.toFixed(0)}ג</span>
          </div>
        </div>
      </div>

      {/* Manual add */}
      <div className="section">
        <h2>
          <span className="material-symbols-outlined">add_circle</span>
          הוסף ערך ידני
        </h2>
        <p className="tracker-manual-hint">
          רשום שם וכמות — המערכת תזהה קלוריות וחלבון אוטומטית. ניתן לתקן לפני הוספה.
        </p>
        <div className="tracker-manual-grid">
          <input
            className="manual-name"
            type="text"
            placeholder="לדוגמה: תפוח / חזה עוף / יוגורט"
            value={mName}
            onChange={(e) => { setMName(e.target.value); if (mStatus !== "idle") setMStatus("idle"); }}
            onBlur={runManualAnalyze}
            aria-label="שם הפריט"
          />
          <input
            className="manual-qty"
            type="number"
            min={0}
            step="any"
            placeholder="כמות"
            value={mQty === "" ? "" : mQty}
            onChange={(e) => { const v = e.target.value; setMQty(v === "" ? "" : Math.max(0, Number(v))); if (mStatus !== "idle") setMStatus("idle"); }}
            onBlur={runManualAnalyze}
            aria-label="כמות"
          />
          <select
            className="manual-unit"
            value={mUnit}
            onChange={(e) => { setMUnit(e.target.value as HebrewUnit); if (mStatus !== "idle") setMStatus("idle"); }}
            onBlur={runManualAnalyze}
            aria-label="יחידה"
          >
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <input
            className="manual-cal"
            type="number"
            min={0}
            step="any"
            placeholder='קק"ל'
            value={mCalories === "" ? "" : mCalories}
            onChange={(e) => { const v = e.target.value; setMCalories(v === "" ? "" : Math.max(0, Number(v))); }}
            aria-label="קלוריות"
          />
          <input
            className="manual-protein"
            type="number"
            min={0}
            step="any"
            placeholder="חלבון (ג')"
            value={mProtein === "" ? "" : mProtein}
            onChange={(e) => { const v = e.target.value; setMProtein(v === "" ? "" : Math.max(0, Number(v))); }}
            aria-label="חלבון בגרם"
          />
        </div>
        <div className="tracker-manual-actions">
          <span className={`manual-status ${mStatus}`}>
            {mStatus === "loading" && "מזהה..."}
            {mStatus === "ready" && "✓ ערכים זוהו — ניתן לערוך"}
            {mStatus === "none" && "⚠ לא נמצא — מלאו ידנית"}
            {mStatus === "error" && "✕ שגיאה — מלאו ידנית"}
            {mStatus === "idle" && " "}
          </span>
          <button
            type="button"
            className="primary"
            onClick={handleManualAdd}
            disabled={!mName.trim() || mCalories === "" || (typeof mCalories === "number" && mCalories <= 0)}
          >
            הוסף ליום
          </button>
        </div>
      </div>

      {/* Today's entries quick list */}
      <div className="section">
        <div className="tracker-list-header">
          <span>ארוחות היום ({state.entries.length})</span>
          {state.entries.length > 0 && (
            <button type="button" className="ghost tracker-reset-btn" onClick={handleResetDay}>
              איפוס היום
            </button>
          )}
        </div>
        {state.entries.length === 0 ? (
          <p className="tracker-empty">
            עדיין לא נרשמו ארוחות. הוסיפו מארוחה, מתכון, או ידנית.
          </p>
        ) : (
          <ul className="tracker-list">
            {[...state.entries].reverse().map((entry) => (
              <li key={entry.id}>
                <div className="tracker-entry-main">
                  <div className="tracker-entry-name">{entry.name}</div>
                  {entry.protein > 0 && (
                    <div className="tracker-entry-meta">חלבון {entry.protein.toFixed(1)}ג'</div>
                  )}
                </div>
                <div className="tracker-entry-cal">{entry.calories.toFixed(0)} קק"ל</div>
                <button
                  type="button"
                  className="row-icon-button"
                  onClick={() => removeEntry(entry.id)}
                  title="מחק"
                  aria-label={`מחק ${entry.name}`}
                >✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
