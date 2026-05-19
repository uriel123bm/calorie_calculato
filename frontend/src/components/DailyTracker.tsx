import { useCallback, useMemo, useRef, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type {
  DailyEntryInput,
  DailyTrackerState,
  DayLog,
  MealType,
  UserProduct,
} from "../types";
import { MEAL_TYPE_ICONS, MEAL_TYPE_LABELS } from "../types";
import type { GoalTipsInput } from "../utils/goalTips";
import { GoalTipsCard } from "./GoalTipsCard";
import { HomeHeroIcon } from "./HomeHeroIcon";
import { PersonalPlanCard } from "./PersonalPlanCard";
import type { PersonalPlanRecord } from "../types/personalPlan";
import { scaleServingMacros } from "../utils/nutritionMath";
import { roundCalories, roundMacro } from "../utils/nutritionRounding";
import {
  copyTextToClipboard,
  formatDailyJournalText,
  shareTextIfPossible,
} from "../utils/exportText";
import { PdfExportButton } from "./PdfExportButton";
import { PersonalProductChips } from "./PersonalProductChips";
import { TrackerManualAdd } from "./TrackerManualAdd";
import { SwipeDeleteRow } from "./SwipeDeleteRow";
import type { UseWaterTrackerResult } from "../hooks/useWaterTracker";
import { CUP_ML } from "../hooks/useWaterTracker";

export interface MacroTargets {
  protein: number;
  carbs: number;
  fat: number;
}

interface Props {
  state: DailyTrackerState;
  history: DayLog[];
  streak: number;
  setTarget: (target: number) => void;
  addEntry: (input: DailyEntryInput) => void;
  removeEntry: (id: string) => void;
  resetDay: () => void;
  personalPlan?: PersonalPlanRecord | null;
  onOpenPlanWizard?: () => void;
  /** Personal library — shown as quick-add chips when non-empty. */
  personalProducts?: UserProduct[];
  /** טיפים יומיים לפי מטרה/משקל — רק אם הוגדר פרופיל בהתקדמות */
  goalTipsContext?: GoalTipsInput | null;
  water?: UseWaterTrackerResult;
  afterWater?: React.ReactNode;
  /** לחיצה על עמודה בגרף — מועברת ל-WeeklyChart לניווט ליומן */
  onDayClick?: (date: string) => void;
  /** יעדי מאקרו יומיים — לתצוגת פרוגרס-בר */
  macroTargets?: MacroTargets;
  /** עדכון יעדי מאקרו מתוך ממשק הבנטו */
  onMacroTargetsChange?: (targets: MacroTargets) => void;
}

function PersonalProductQuickAdd({
  products,
  onAdd,
}: {
  products: UserProduct[];
  onAdd: (input: DailyEntryInput) => void;
}) {
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState<number | "">("");
  const [mode, setMode] = useState<"units" | "grams">("units");

  const selected = products.find((p) => p.id === productId);
  const qNum = typeof qty === "number" ? qty : 0;
  const hasGramData = !!(selected?.per100g);

  const preview = useMemo(() => {
    if (!selected || qNum <= 0) return null;
    if (mode === "grams" && selected.per100g) {
      const f = qNum / 100;
      return {
        calories: selected.per100g.calories * f,
        protein: selected.per100g.protein * f,
        carbohydrates: selected.per100g.carbohydrates * f,
        fat: selected.per100g.fat * f,
      };
    }
    return scaleServingMacros(selected, qNum);
  }, [selected, qNum, mode]);

  const handleProductChange = (id: string) => {
    setProductId(id);
    setQty("");
    const p = products.find((pr) => pr.id === id);
    setMode(p?.per100g ? "grams" : "units");
  };

  const handleAdd = () => {
    if (!selected || !preview || qNum <= 0) return;
    const label = mode === "grams" ? `${qNum} גרם` : `${qNum} יח׳`;
    onAdd({
      name: `${selected.name} (${label})`,
      calories: roundCalories(preview.calories),
      protein: roundMacro(preview.protein),
      carbohydrates: roundMacro(preview.carbohydrates),
      fat: roundMacro(preview.fat),
    });
    setQty("");
    setProductId("");
  };

  return (
    <div className="tracker-quick-product-wrap">
      <div className="tracker-quick-product-row">
        <select
          className="tracker-quick-select"
          value={productId}
          onChange={(e) => handleProductChange(e.target.value)}
          aria-label="בחר מוצר אישי"
        >
          <option value="">— בחרו מוצר —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          className="tracker-quick-qty"
          min={0}
          step="any"
          placeholder="כמות"
          value={qty === "" ? "" : qty}
          onChange={(e) =>
            setQty(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))
          }
          aria-label={mode === "grams" ? "כמות בגרמים" : "כמות יחידות"}
        />
        {hasGramData && (
          <div className="tracker-quick-mode-toggle" role="group" aria-label="שיטת מדידה">
            <button
              type="button"
              className={`tracker-quick-mode-btn${mode === "grams" ? " active" : ""}`}
              onClick={() => setMode("grams")}
              title="הזן גרמים"
            >גרם</button>
            <button
              type="button"
              className={`tracker-quick-mode-btn${mode === "units" ? " active" : ""}`}
              onClick={() => setMode("units")}
              title="הזן יחידות"
            >יח׳</button>
          </div>
        )}
        {!hasGramData && <span className="tracker-quick-unit-label">יח׳</span>}
        <button
          type="button"
          className="primary"
          disabled={!preview || qNum <= 0}
          onClick={handleAdd}
        >
          הוסף ליום
        </button>
      </div>
      {preview && qNum > 0 && (
        <div className="tracker-quick-preview-row">
          <span className="tracker-quick-preview">≈ {Math.round(preview.calories)} קלוריות</span>
          {preview.protein > 0 && <span className="tracker-quick-preview-macro">חלבון {roundMacro(preview.protein)}גרם</span>}
          {preview.carbohydrates > 0 && <span className="tracker-quick-preview-macro">פחמימות {roundMacro(preview.carbohydrates)}גרם</span>}
          {preview.fat > 0 && <span className="tracker-quick-preview-macro">שומן {roundMacro(preview.fat)}גרם</span>}
        </div>
      )}
    </div>
  );
}

const WATER_QUICK = [
  { label: "כוס",       ml: CUP_ML },
  { label: "2 כוסות",  ml: CUP_ML * 2 },
  { label: "חצי ליטר", ml: 500 },
  { label: "ליטר",     ml: 1000 },
];

const WATER_GOAL_OPTIONS = [1.5, 2, 2.5, 3, 3.5, 4];

function fmtLiters(ml: number): string {
  const val = ml / 1000;
  return (Number.isInteger(val) ? val.toString() : val.toFixed(2).replace(/0+$/, "")) + " ל׳";
}

function WaterWidget({ water }: { water: UseWaterTrackerResult }) {
  const { totalMl, pct, state, addWater, removeLastEntry, setGoal } = water;
  const [editingGoal, setEditingGoal] = useState(false);
  const [draftGoal, setDraftGoal] = useState<number | "">(state.goalMl / 1000);

  const goalLiters = (state.goalMl / 1000).toFixed(1);
  const totalLiters = (totalMl / 1000).toFixed(2);

  const handleGoalSave = () => {
    const val = Number(draftGoal);
    if (val > 0) setGoal(Math.round(val * 1000));
    setEditingGoal(false);
  };

  return (
    <div className="water-widget">
      <div className="water-widget-header">
        <span className="material-symbols-outlined water-icon">water_drop</span>
        <span className="water-title">שתייה</span>
        <span className="water-total" dir="ltr">
          {totalLiters} / {goalLiters} ל׳
        </span>
        <button
          type="button"
          className="ghost water-goal-edit-btn"
          onClick={() => { setDraftGoal(state.goalMl / 1000); setEditingGoal((v) => !v); }}
          title="שנה יעד שתייה"
          aria-label="שנה יעד שתייה יומי"
        >
          <span className="material-symbols-outlined">edit</span>
        </button>
      </div>

      {editingGoal && (
        <div className="water-goal-editor">
          <span className="water-goal-editor-label">יעד יומי (ליטרים):</span>
          <div className="water-goal-chips">
            {WATER_GOAL_OPTIONS.map((l) => (
              <button
                key={l}
                type="button"
                className={`water-goal-chip${state.goalMl === l * 1000 ? " active" : ""}`}
                onClick={() => { setGoal(l * 1000); setDraftGoal(l); setEditingGoal(false); }}
              >
                {l} ל׳
              </button>
            ))}
          </div>
          <div className="water-goal-custom-row">
            <input
              type="number"
              className="water-custom-input"
              min={0.5}
              step={0.5}
              value={draftGoal === "" ? "" : draftGoal}
              onChange={(e) => setDraftGoal(e.target.value === "" ? "" : Number(e.target.value))}
              aria-label="יעד מותאם אישית בליטרים"
              placeholder="ל׳ מותאם"
            />
            <button type="button" className="primary water-btn" onClick={handleGoalSave}>
              שמור
            </button>
          </div>
        </div>
      )}

      <div className="water-progress-bar">
        <div className="water-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      {pct >= 100 && (
        <p className="water-goal-reached">🎉 הגעת ליעד השתייה היומי!</p>
      )}
      <div className="water-actions">
        {WATER_QUICK.map(({ label, ml }) => (
          <button key={ml} type="button" className="ghost water-btn" onClick={() => addWater(ml)}>
            +{label}
          </button>
        ))}
        {state.entries.length > 0 && (
          <button type="button" className="ghost water-btn water-undo" onClick={removeLastEntry} title="בטל אחרון">
            ↩ {fmtLiters(state.entries[state.entries.length - 1].amountMl)}
          </button>
        )}
      </div>
    </div>
  );
}

function WeeklyChart({
  today,
  history,
  onDayClick,
}: {
  today: DailyTrackerState;
  history: DayLog[];
  onDayClick?: (date: string) => void;
}) {
  const data = useMemo(() => {
    const days: { label: string; cal: number; target: number; isToday: boolean; date: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.date);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split("T")[0];
      const isToday = ds === today.date;
      const dayData = isToday
        ? today
        : history.find((h) => h.date === ds);
      const cal = dayData ? Math.round(dayData.entries.reduce((s, e) => s + e.calories, 0)) : 0;
      const target = dayData?.targetCalories ?? today.targetCalories;
      const label = d.toLocaleDateString("he-IL", { weekday: "short" });
      days.push({ label, cal, target, isToday, date: ds });
    }
    return days;
  }, [today, history]);

  const hasData = data.some((d) => d.cal > 0);
  if (!hasData) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBarClick = (barData: any) => {
    if (onDayClick && barData?.date) {
      onDayClick(barData.date as string);
    }
  };

  return (
    <div className="weekly-chart-wrap">
      <div className="weekly-chart-title">7 ימים אחרונים</div>
      {onDayClick && (
        <p className="weekly-chart-hint">לחצו על עמודה כדי לעבור ליום ביומן</p>
      )}
      <ResponsiveContainer width="100%" height={90}>
        <BarChart
          data={data}
          barSize={18}
          margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
        >
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(v) => [`${Number(v)} קלוריות`, ""]}
            labelStyle={{ direction: "rtl" }}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar
            dataKey="cal"
            radius={[4, 4, 0, 0]}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onClick={onDayClick ? (barData: any) => handleBarClick(barData) : undefined}
            style={onDayClick ? { cursor: "pointer" } : undefined}
          >
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.isToday ? "var(--primary)" : d.cal > d.target ? "var(--error, #e74c3c)" : "var(--primary-light, #a8d5b5)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const DEFAULT_MACRO_TARGETS: MacroTargets = { protein: 120, carbs: 250, fat: 70 };

export function DailyTracker({
  state,
  history,
  streak,
  setTarget,
  addEntry,
  removeEntry,
  resetDay,
  personalPlan = null,
  onOpenPlanWizard,
  personalProducts = [],
  goalTipsContext = null,
  water,
  afterWater,
  onDayClick,
  macroTargets,
  onMacroTargetsChange,
}: Props) {
  const dayExportRef = useRef<HTMLDivElement>(null);
  const [exportFlash, setExportFlash] = useState<string | null>(null);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [editingMacros, setEditingMacros] = useState(false);
  const [draftMacros, setDraftMacros] = useState<MacroTargets>(macroTargets ?? DEFAULT_MACRO_TARGETS);

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

  const flashExport = useCallback((msg: string) => {
    setExportFlash(msg);
    window.setTimeout(() => setExportFlash(null), 2200);
  }, []);

  const handleQuickChipAdd = useCallback(
    (p: UserProduct) => {
      const preview = scaleServingMacros(p, 1);
      addEntry({
        name: `${p.name} (1 יח׳)`,
        calories: roundCalories(preview.calories),
        protein: roundMacro(preview.protein),
        carbohydrates: roundMacro(preview.carbohydrates),
        fat: roundMacro(preview.fat),
      });
    },
    [addEntry]
  );

  const handleCopyDay = async () => {
    const ok = await copyTextToClipboard(formatDailyJournalText(state));
    flashExport(ok ? "הטקסט הועתק ללוח." : "לא הצלחנו להעתיק — נסו מהדפדפן.");
  };

  const handleShareDay = async () => {
    const text = formatDailyJournalText(state);
    const shared = await shareTextIfPossible("קלוריות היום", text);
    if (!shared) void handleCopyDay();
    else flashExport("נפתח חלון שיתוף.");
  };

  const handleResetDay = () => {
    if (state.entries.length === 0) return;
    const ok = window.confirm("לאפס את כל הרשומות של היום?");
    if (!ok) return;
    resetDay();
  };

  const MEAL_ORDER: (MealType | "none")[] = ["breakfast", "lunch", "dinner", "snack", "none"];

  const groupedEntries = useMemo(() => {
    const groups: Record<string, typeof state.entries> = {};
    for (const entry of [...state.entries].reverse()) {
      const key = entry.mealType ?? "none";
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    }
    return groups;
  }, [state.entries]);

  return (
    <div className="page-container">
      {exportFlash && (
        <p className="tracker-export-flash" role="status" aria-live="polite">
          {exportFlash}
        </p>
      )}
      {/* Page hero */}
      <div className="page-hero page-hero--home">
        <div className="home-hero-emblem" aria-hidden="true">
          <HomeHeroIcon variant="hero" size={56} />
        </div>
        <div>
          <h2 className="page-title">קלוריות היומיות</h2>
          <p className="page-subtitle">עקוב אחרי מה שאכלת היום</p>
        </div>
        {streak >= 2 && (
          <div className="streak-badge" title={`${streak} ימים ברצף!`}>
            <span className="material-symbols-outlined">local_fire_department</span>
            {streak}
          </div>
        )}
      </div>

      {onOpenPlanWizard && (
        <PersonalPlanCard
          plan={personalPlan}
          currentTargetCalories={state.targetCalories}
          onOpenQuestionnaire={onOpenPlanWizard}
        />
      )}

      <WeeklyChart today={state} history={history} onDayClick={onDayClick} />

      {goalTipsContext && (
        <GoalTipsCard input={goalTipsContext} variant="compact" />
      )}

      {water && <WaterWidget water={water} />}

      {afterWater}

      {personalProducts.length > 0 && (
        <div className="section tracker-quick-products">
          <h2>
            <span className="material-symbols-outlined">inventory_2</span>
            מהיר מהמוצרים האישיים
          </h2>
          <p className="tracker-manual-hint">
            בחרו מוצר והזינו כמה יחידות אכלתם — הערכים מחושבים לפי יחידה אחת כפי שהגדרתם בטאב מוצרים.
          </p>
          <PersonalProductChips
            products={personalProducts}
            onPick={handleQuickChipAdd}
            title="הוספה מהירה ליום (יחידה אחת)"
          />
          <PersonalProductQuickAdd products={personalProducts} onAdd={addEntry} />
        </div>
      )}

      <div ref={dayExportRef} className="tracker-day-export-block">
      <div className="daily-tracker-top-grid" aria-live="polite" aria-atomic="true">
        {/* Target input */}
        <div className="section">
          <div className="target-row">
            <label htmlFor="daily-target">יעד יומי (קלוריות):</label>
            <input
              id="daily-target"
              type="number"
              min={0}
              step={50}
              value={state.targetCalories}
              onChange={(e) => setTarget(Number(e.target.value))}
            />
            {onOpenPlanWizard && (
              <button
                type="button"
                className="tracker-target-recalc-link"
                onClick={onOpenPlanWizard}
              >
                חשב יעד מחדש
              </button>
            )}
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
                      style={{ strokeDashoffset: offset }}
                    />
                  </svg>
                  <div className="ring-inner">
                    <span className={`ring-calories${overshoot ? " over" : ""}`}>
                      {Math.abs(Math.round(remaining))}
                    </span>
                    <span className="ring-label">
                      {overshoot ? "חרגת (קלוריות)" : "נותרו (קלוריות)"}
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
          {(() => {
            const mt = macroTargets ?? DEFAULT_MACRO_TARGETS;
            return (
              <div className="macro-bento">
                <div className="macro-tile protein">
                  <span className="material-symbols-outlined macro-icon">egg</span>
                  <span className="macro-label">חלבון</span>
                  <div className="progress-bar"><div className="progress-fill green" style={{ width: `${Math.min(100, (totals.protein / mt.protein) * 100)}%` }} /></div>
                  <span className="macro-value">{totals.protein.toFixed(0)} / {mt.protein} גרם</span>
                </div>
                <div className="macro-tile carbs">
                  <span className="material-symbols-outlined macro-icon">bakery_dining</span>
                  <span className="macro-label">פחמימות</span>
                  <div className="progress-bar"><div className="progress-fill orange" style={{ width: `${Math.min(100, (totals.carbohydrates / mt.carbs) * 100)}%` }} /></div>
                  <span className="macro-value">{totals.carbohydrates.toFixed(0)} / {mt.carbs} גרם</span>
                </div>
                <div className="macro-tile fat">
                  <span className="material-symbols-outlined macro-icon">opacity</span>
                  <span className="macro-label">שומן</span>
                  <div className="progress-bar"><div className="progress-fill teal" style={{ width: `${Math.min(100, (totals.fat / mt.fat) * 100)}%` }} /></div>
                  <span className="macro-value">{totals.fat.toFixed(0)} / {mt.fat} גרם</span>
                </div>
                {onMacroTargetsChange && (
                  <button
                    type="button"
                    className="macro-bento-edit-btn ghost"
                    onClick={() => { setDraftMacros(mt); setEditingMacros(true); }}
                    title="ערוך יעדי מאקרו"
                    aria-label="ערוך יעדי מאקרו"
                  >
                    <span className="material-symbols-outlined">edit</span>
                    יעדים
                  </button>
                )}
              </div>
            );
          })()}

          {editingMacros && onMacroTargetsChange && (
            <div className="macro-targets-editor">
              <strong className="macro-targets-editor-title">יעדי מאקרו יומיים</strong>
              {(["protein", "carbs", "fat"] as const).map((key) => {
                const labels = { protein: "חלבון (גרם)", carbs: "פחמימות (גרם)", fat: "שומן (גרם)" };
                return (
                  <label key={key} className="macro-targets-field">
                    <span>{labels[key]}</span>
                    <input
                      type="number"
                      min={0}
                      step={5}
                      value={draftMacros[key]}
                      onChange={(e) =>
                        setDraftMacros((prev) => ({ ...prev, [key]: Math.max(0, Number(e.target.value)) }))
                      }
                    />
                  </label>
                );
              })}
              <div className="macro-targets-actions">
                <button type="button" className="ghost" onClick={() => setEditingMacros(false)}>ביטול</button>
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    onMacroTargetsChange(draftMacros);
                    setEditingMacros(false);
                  }}
                >
                  שמור
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

        <TrackerManualAdd
          personalProducts={personalProducts}
          onAdd={addEntry}
          submitLabel="הוסף ליום"
        />
      </div>

      {/* Today's entries quick list */}
      <div className="section">
        <div className="tracker-list-header">
          <span>ארוחות היום ({state.entries.length})</span>
          <div className="tracker-list-header-actions">
            {state.entries.length > 0 && (
              <>
                <button type="button" className="ghost" onClick={handleCopyDay}>
                  העתק יום (טקסט)
                </button>
                <button type="button" className="ghost" onClick={handleShareDay}>
                  שתף
                </button>
                <PdfExportButton
                  targetRef={dayExportRef}
                  filename={`קלוריות-${state.date}.pdf`}
                />
              </>
            )}
            {state.entries.length > 0 && (
              <button type="button" className="ghost tracker-reset-btn" onClick={handleResetDay}>
                איפוס היום
              </button>
            )}
          </div>
        </div>
        {state.entries.length === 0 ? (
          <div className="tracker-empty-state">
            <span className="material-symbols-outlined tracker-empty-icon">restaurant</span>
            <p className="tracker-empty-title">לא נרשמו ארוחות להיום</p>
            <p className="tracker-empty-sub">הוסיפו ארוחה, מתכון, או פריט ידני למעלה</p>
          </div>
        ) : (
          <>
          {MEAL_ORDER.map((mealKey) => {
            const entries = groupedEntries[mealKey];
            if (!entries || entries.length === 0) return null;
            const label = mealKey === "none" ? "כללי" : MEAL_TYPE_LABELS[mealKey as MealType];
            const icon  = mealKey === "none" ? "more_horiz" : MEAL_TYPE_ICONS[mealKey as MealType];
            const groupCal = entries.reduce((s, e) => s + e.calories, 0);
            return (
              <div key={mealKey} className="meal-group">
                <div className="meal-group-header">
                  <span className="material-symbols-outlined meal-group-icon">{icon}</span>
                  <span className="meal-group-label">{label}</span>
                  <span className="meal-group-cal">{Math.round(groupCal)} קל׳</span>
                </div>
          <ul className="tracker-list">
            {entries.map((entry) => {
              const lines = entry.lines?.filter((l) => l.name.trim()) ?? [];
              const hasBreakdown = lines.length > 0;
              const expanded = expandedEntryId === entry.id;
              const toggle = () =>
                setExpandedEntryId((id) => (id === entry.id ? null : entry.id));

              const bodyMain = (
                <>
                  <div className="tracker-entry-name">{entry.name}</div>
                  {(entry.protein > 0 || hasBreakdown) && (
                    <div className="tracker-entry-meta">
                      {entry.protein > 0 && (
                        <span>חלבון {entry.protein.toFixed(1)} גרם</span>
                      )}
                      {hasBreakdown && (
                        <span className="tracker-entry-meta-sub">
                          {entry.protein > 0 ? " · " : ""}
                          לחצו לפירוט מצרכים
                        </span>
                      )}
                    </div>
                  )}
                </>
              );

              return (
                <li key={entry.id}>
                  <SwipeDeleteRow onDelete={() => { if (expandedEntryId === entry.id) setExpandedEntryId(null); removeEntry(entry.id); }} deleteLabel={`מחק ${entry.name}`}>
                  <div
                    className={`tracker-entry-shell${expanded ? " tracker-entry-shell--open" : ""}`}
                  >
                    <div className="tracker-entry-top">
                      {hasBreakdown ? (
                        <button
                          type="button"
                          className="tracker-entry-chevron"
                          aria-expanded={expanded}
                          aria-label={
                            expanded ? "סגור פירוט ארוחה" : `פירוט מצרכים: ${entry.name}`
                          }
                          onClick={toggle}
                        >
                          <span className="material-symbols-outlined" aria-hidden="true">
                            {expanded ? "expand_less" : "expand_more"}
                          </span>
                        </button>
                      ) : (
                        <span className="tracker-entry-chevron-spacer" aria-hidden="true" />
                      )}
                      {hasBreakdown ? (
                        <button
                          type="button"
                          className="tracker-entry-body-btn"
                          onClick={toggle}
                        >
                          <div className="tracker-entry-main">{bodyMain}</div>
                        </button>
                      ) : (
                        <div className="tracker-entry-body-static">
                          <div className="tracker-entry-main">{bodyMain}</div>
                        </div>
                      )}
                      <div className="tracker-entry-cal">{entry.calories.toFixed(0)} קלוריות</div>
                      <button
                        type="button"
                        className="row-icon-button"
                        onClick={() => {
                          if (expandedEntryId === entry.id) setExpandedEntryId(null);
                          removeEntry(entry.id);
                        }}
                        title="מחק"
                        aria-label={`מחק ${entry.name}`}
                      >
                        ✕
                      </button>
                    </div>
                    {expanded && hasBreakdown && (
                      <ul className="tracker-entry-breakdown">
                        {lines.map((line, idx) => (
                          <li key={`${entry.id}-ln-${idx}`}>
                            <span className="tracker-entry-line-name">
                              {line.detail ? `${line.name} (${line.detail})` : line.name}
                            </span>
                            <span className="tracker-entry-line-cal">{Math.round(line.calories)} קל׳</span>
                            <span className="tracker-entry-line-macros">
                              {[
                                line.protein > 0 ? `ח׳ ${line.protein.toFixed(1)}` : "",
                                line.carbohydrates > 0 ? `פ׳ ${line.carbohydrates.toFixed(1)}` : "",
                                line.fat > 0 ? `ש׳ ${line.fat.toFixed(1)}` : "",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  </SwipeDeleteRow>
                </li>
              );
            })}
          </ul>
              </div>
            );
          })}
          </>
        )}
      </div>
    </div>
  );
}
