import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { isCancel } from "axios";
import { NUTRITION_SOURCE_BADGES } from "../constants/nutritionSourceBadges";
import { analyzeIngredient } from "../services/api";
import type {
  DailyEntryInput,
  DailyTrackerState,
  HebrewUnit,
  NutritionSource,
  UserProduct,
} from "../types";
import { UNITS } from "../types";
import {
  findPersonalProductByName,
  normalizeProductLabel,
  totalsForProductQuantity,
} from "../utils/personalProductMatch";
import { scaleServingMacros } from "../utils/nutritionMath";
import { roundCalories, roundMacro } from "../utils/nutritionRounding";
import { isOfflineError } from "../utils/network";
import {
  copyTextToClipboard,
  formatDailyJournalText,
  shareTextIfPossible,
} from "../utils/exportText";
import { PdfExportButton } from "./PdfExportButton";
import { PersonalProductChips } from "./PersonalProductChips";

interface Props {
  state: DailyTrackerState;
  setTarget: (target: number) => void;
  addEntry: (input: DailyEntryInput) => void;
  removeEntry: (id: string) => void;
  resetDay: () => void;
  /** Personal library — shown as quick-add chips when non-empty. */
  personalProducts?: UserProduct[];
}

/**
 * Snapshot of the AI-detected nutrition for the manual entry. Used to scale
 * carbs and fat proportionally when the user edits calories before saving.
 */
interface DetectedMacros {
  calories: number;
  carbohydrates: number;
  fat: number;
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

  const selected = products.find((p) => p.id === productId);
  const qNum = typeof qty === "number" ? qty : 0;
  const preview =
    selected && qNum > 0 ? scaleServingMacros(selected, qNum) : null;

  const handleAdd = () => {
    if (!selected || !preview || qNum <= 0) return;
    onAdd({
      name: `${selected.name} (${qNum} יח׳)`,
      calories: roundCalories(preview.calories),
      protein: roundMacro(preview.protein),
      carbohydrates: roundMacro(preview.carbohydrates),
      fat: roundMacro(preview.fat),
    });
    setQty("");
    setProductId("");
  };

  return (
    <div className="tracker-quick-product-row">
      <select
        className="tracker-quick-select"
        value={productId}
        onChange={(e) => setProductId(e.target.value)}
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
        aria-label="כמות יחידות"
      />
      <span className="tracker-quick-unit-label">יח׳</span>
      {preview && qNum > 0 && (
        <span className="tracker-quick-preview">
          ≈ {Math.round(preview.calories)} קלוריות
        </span>
      )}
      <button
        type="button"
        className="primary"
        disabled={!preview || qNum <= 0}
        onClick={handleAdd}
      >
        הוסף ליום
      </button>
    </div>
  );
}

export function DailyTracker({
  state,
  setTarget,
  addEntry,
  removeEntry,
  resetDay,
  personalProducts = [],
}: Props) {
  // Manual entry state
  const [mName, setMName] = useState("");
  const [mQty, setMQty] = useState<number | "">(100);
  const [mUnit, setMUnit] = useState<HebrewUnit>("גרם");
  const [mCalories, setMCalories] = useState<number | "">("");
  const [mProtein, setMProtein] = useState<number | "">("");
  const [mDetected, setMDetected] = useState<DetectedMacros | null>(null);
  const [mAnalyzeMeta, setMAnalyzeMeta] = useState<{
    source: NutritionSource;
    confidence: number;
    matchedName: string | null;
  } | null>(null);
  const [mStatus, setMStatus] = useState<"idle" | "loading" | "ready" | "error" | "none">("idle");

  const manualProductsListId = useId().replace(/:/g, "");
  const matchedPersonalRef = useRef<UserProduct | null>(null);
  const dayExportRef = useRef<HTMLDivElement>(null);
  const manualFieldsRef = useRef({
    name: "",
    qty: 100 as number | "",
    unit: "גרם" as HebrewUnit,
  });
  const manualEpochRef = useRef(0);
  const manualDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualAbortRef = useRef<AbortController | null>(null);
  const MANUAL_DEBOUNCE_MS = 420;
  const [exportFlash, setExportFlash] = useState<string | null>(null);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  useEffect(() => {
    manualFieldsRef.current = { name: mName, qty: mQty, unit: mUnit };
  }, [mName, mQty, mUnit]);

  useEffect(() => {
    return () => {
      if (manualDebounceRef.current) clearTimeout(manualDebounceRef.current);
      manualAbortRef.current?.abort();
    };
  }, []);

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
      if (isOfflineError(e)) flashExport(e.message);
    }
  }, [flashExport]);

  const scheduleIngredientAnalyze = useCallback(() => {
    if (manualDebounceRef.current) clearTimeout(manualDebounceRef.current);
    manualAbortRef.current?.abort();
    manualDebounceRef.current = setTimeout(() => {
      manualDebounceRef.current = null;
      void runIngredientAnalyze();
    }, MANUAL_DEBOUNCE_MS);
  }, [runIngredientAnalyze]);

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

  const handleManualNameBlur = () => {
    const trimmed = mName.trim();
    if (!trimmed) return;
    const libs = personalProducts.length ? personalProducts : [];
    const hit = findPersonalProductByName(trimmed, libs);
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

    // Scale detected carbs/fat by the user's adjusted calories so the totals
    // stay consistent. If the AI didn't return anything we fall back to 0.
    let carbs = 0;
    let fat = 0;
    if (mDetected && mDetected.calories > 0) {
      const factor = cals / mDetected.calories;
      carbs = roundMacro(mDetected.carbohydrates * factor);
      fat = roundMacro(mDetected.fat * factor);
    }

    matchedPersonalRef.current = null;
    addEntry({
      name: mName.trim(),
      calories: roundCalories(cals),
      protein: roundMacro(typeof mProtein === "number" ? mProtein : 0),
      carbohydrates: carbs,
      fat,
    });
    setMName(""); setMQty(100); setMUnit("גרם");
    setMCalories(""); setMProtein("");
    setMDetected(null);
    setMAnalyzeMeta(null);
    setMStatus("idle");
  };

  const handleResetDay = () => {
    if (state.entries.length === 0) return;
    const ok = window.confirm("לאפס את כל הרשומות של היום?");
    if (!ok) return;
    resetDay();
  };

  return (
    <div className="page-container">
      {exportFlash && (
        <p className="tracker-export-flash" role="status" aria-live="polite">
          {exportFlash}
        </p>
      )}
      {/* Page hero */}
      <div className="page-hero">
        <span className="material-symbols-outlined page-hero-icon">monitoring</span>
        <div>
          <h2 className="page-title">קלוריות היומיות</h2>
          <p className="page-subtitle">עקוב אחרי מה שאכלת היום</p>
        </div>
      </div>

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
          <div className="macro-bento">
            <div className="macro-tile protein">
              <span className="material-symbols-outlined macro-icon">egg</span>
              <span className="macro-label">חלבון</span>
              <div className="progress-bar"><div className="progress-fill green" style={{ width: `${Math.min(100, (totals.protein / 120) * 100)}%` }} /></div>
              <span className="macro-value">{totals.protein.toFixed(0)} גרם</span>
            </div>
            <div className="macro-tile carbs">
              <span className="material-symbols-outlined macro-icon">bakery_dining</span>
              <span className="macro-label">פחמימות</span>
              <div className="progress-bar"><div className="progress-fill orange" style={{ width: `${Math.min(100, (totals.carbohydrates / 250) * 100)}%` }} /></div>
              <span className="macro-value">{totals.carbohydrates.toFixed(0)} גרם</span>
            </div>
            <div className="macro-tile fat">
              <span className="material-symbols-outlined macro-icon">opacity</span>
              <span className="macro-label">שומן</span>
              <div className="progress-bar"><div className="progress-fill teal" style={{ width: `${Math.min(100, (totals.fat / 70) * 100)}%` }} /></div>
              <span className="macro-value">{totals.fat.toFixed(0)} גרם</span>
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
            {personalProducts.length > 0
              ? "בשם הפריט אפשר לכתוב מוצר מהספרייה שלך — יוטען עם המנה והערכים ששמרת. אחרת המערכת תנסה לזהות מהשירות."
              : "רשום שם וכמות — המערכת תזהה קלוריות וחלבון אוטומטית. ניתן לתקן לפני הוספה."}
          </p>
          {personalProducts.length > 0 && (
            <PersonalProductChips
              products={personalProducts}
              onPick={applyPersonalProductFill}
              title="מילוי מהיר בשורת ההוספה הידנית"
            />
          )}
          <div className="tracker-manual-grid">
            <div className="manual-field manual-field--name">
              <label className="manual-field-label" htmlFor="tracker-manual-name">
                שם הפריט
              </label>
              <input
                id="tracker-manual-name"
                className="manual-input manual-name"
                type="text"
                placeholder={
                  personalProducts.length > 0
                    ? "הקלידו את שם מוצר מהספרייה או כל מזון…"
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
                aria-label="שם הפריט"
              />
            </div>

            <div className="manual-field manual-field--qty">
              <label className="manual-field-label" htmlFor="tracker-manual-qty">
                כמות
              </label>
              <input
                id="tracker-manual-qty"
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
              <span className="manual-field-label" id="manual-unit-caption">
                יחידת מידה
              </span>
              {/* Select גלוי (בלי צבע שקוף — כדי שלא ייפגע טקסט ברשימה ב-Chromium). החץ עם pointer-events: none מעל. */}
              <div className="manual-select-shell">
                <select
                  id="tracker-manual-unit"
                  className="manual-unit-select-native"
                  title="פתחו ובחרו יחידה מהרשימה"
                  aria-labelledby="manual-unit-caption"
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
              <label className="manual-field-label" htmlFor="tracker-manual-cal">
                קלוריות (לכמות שציינת)
              </label>
              <input
                id="tracker-manual-cal"
                className="manual-input manual-cal"
                type="number"
                min={0}
                step="any"
                placeholder="—"
                value={mCalories === "" ? "" : mCalories}
                onChange={(e) => {
                  const v = e.target.value;
                  setMCalories(v === "" ? "" : Math.max(0, Number(v)));
                }}
              />
            </div>

            <div className="manual-field manual-field--protein">
              <label className="manual-field-label" htmlFor="tracker-manual-protein">
                חלבון (גרם)
              </label>
              <input
                id="tracker-manual-protein"
                className="manual-input manual-protein"
                type="number"
                min={0}
                step="any"
                placeholder="—"
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
          {(mStatus === "ready" || mStatus === "none") && mAnalyzeMeta && (
            <div className="manual-analyze-meta" aria-live="polite">
              <span className={`badge ${NUTRITION_SOURCE_BADGES[mAnalyzeMeta.source]?.cls ?? "unknown"}`}>
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
          <p className="tracker-empty">
            עדיין לא נרשמו ארוחות. הוסיפו מארוחה, מתכון, או ידנית.
          </p>
        ) : (
          <ul className="tracker-list">
            {[...state.entries].reverse().map((entry) => {
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
                </li>
              );
            })}
          </ul>
        )}
      </div>
      </div>
    </div>
  );
}
