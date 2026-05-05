import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIngredientRows } from "../hooks/useIngredientRows";
import type { DailyEntryInput, DailyEntryLine, HebrewUnit, UserProduct } from "../types";
import {
  copyTextToClipboard,
  formatMealDraftText,
  shareTextIfPossible,
} from "../utils/exportText";
import { personalProductToIngredientPer100g } from "../utils/personalProductMatch";
import { roundCalories, roundMacro } from "../utils/nutritionRounding";
import { IngredientTable } from "./IngredientTable";
import { PdfExportButton } from "./PdfExportButton";
import { PersonalProductChips } from "./PersonalProductChips";

interface Props {
  id: string;
  name: string;
  onUpdateName: (name: string) => void;
  onRemove: () => void;
  onAddToDaily: (input: DailyEntryInput) => void;
  personalProducts?: UserProduct[];
}

export function Meal({
  id: mealId,
  name,
  onUpdateName,
  onRemove,
  onAddToDaily,
  personalProducts,
}: Props) {
  const {
    rows,
    hydrateRows,
    patchRow,
    addRow,
    removeRow,
    analyzeRow,
    handleNutritionEdit,
    total,
    totalGrams,
  } = useIngredientRows(3);
  const mealDraftKey = `meal_draft:${mealId}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(mealDraftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as typeof rows;
      if (Array.isArray(parsed) && parsed.length > 0) {
        hydrateRows(parsed);
      }
    } catch {
      /* ignore */
    }
    // one-time hydrate per meal card
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealDraftKey]);

  useEffect(() => {
    try {
      localStorage.setItem(mealDraftKey, JSON.stringify(rows));
    } catch {
      /* ignore */
    }
  }, [mealDraftKey, rows]);

  const pendingChipProductRef = useRef<UserProduct | null>(null);

  const applyLibraryProductToRow = useCallback(
    (rowId: string, product: UserProduct) => {
      const per100 = personalProductToIngredientPer100g(product);
      patchRow(rowId, {
        name: product.name,
        nutritionPer100g: per100,
        quantity: 1,
        unit: "יחידה" as HebrewUnit,
        manualEdit: true,
        source: "personal_library",
        status: "ready",
        confidence: 1,
        matchedName: product.name,
      });
    },
    [patchRow]
  );

  useEffect(() => {
    const p = pendingChipProductRef.current;
    if (!p) return;
    const last = rows[rows.length - 1];
    if (!last?.name.trim()) {
      pendingChipProductRef.current = null;
      applyLibraryProductToRow(last.id, p);
    }
  }, [rows, applyLibraryProductToRow]);

  const handleChipPick = useCallback(
    (product: UserProduct) => {
      const empty = rows.find((r) => !r.name.trim());
      if (empty) {
        applyLibraryProductToRow(empty.id, product);
        return;
      }
      pendingChipProductRef.current = product;
      addRow();
    },
    [rows, addRow, applyLibraryProductToRow]
  );

  const hasContent = useMemo(
    () => rows.some((r) => r.name.trim() && r.quantityInGrams > 0),
    [rows]
  );

  const mealExportRef = useRef<HTMLDivElement>(null);
  const [mealExportFlash, setMealExportFlash] = useState<string | null>(null);

  const flashMealExport = useCallback((msg: string) => {
    setMealExportFlash(msg);
    window.setTimeout(() => setMealExportFlash(null), 2200);
  }, []);

  const mealPdfName = useMemo(() => {
    const base = name.trim() || "ארוחה";
    const safe = base.replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 80);
    return `${safe || "ארוחה"}.pdf`;
  }, [name]);

  const productNamesForSuggest = useMemo(
    () => personalProducts?.map((p) => p.name) ?? [],
    [personalProducts]
  );

  const handleCopyMeal = async () => {
    const text = formatMealDraftText(name, rows, total, totalGrams);
    const ok = await copyTextToClipboard(text);
    flashMealExport(ok ? "הטקסט הועתק ללוח." : "לא הצלחנו להעתיק — נסו מהדפדפן.");
  };

  const handleShareMeal = async () => {
    const text = formatMealDraftText(name, rows, total, totalGrams);
    const title = name.trim() || "ארוחה";
    const shared = await shareTextIfPossible(title, text);
    if (!shared) void handleCopyMeal();
    else flashMealExport("נפתח חלון שיתוף.");
  };

  const handleAdd = () => {
    if (!hasContent) return;
    const lines: DailyEntryLine[] = rows
      .filter((r) => r.name.trim() && r.quantityInGrams > 0)
      .map((r) => {
        const q = r.quantity === "" ? "" : `${r.quantity} ${r.unit}`;
        const n = r.nutritionForQuantity;
        return {
          name: r.name.trim(),
          calories: roundCalories(n.calories),
          protein: roundMacro(n.protein),
          carbohydrates: roundMacro(n.carbohydrates),
          fat: roundMacro(n.fat),
          ...(q ? { detail: q } : {}),
        };
      });
    if (lines.length === 0) return;

    onAddToDaily({
      name: name.trim() || "ארוחה",
      calories: roundCalories(total.calories),
      protein: roundMacro(total.protein),
      carbohydrates: roundMacro(total.carbohydrates),
      fat: roundMacro(total.fat),
      lines,
    });
  };

  return (
    <div className="meal-card">
      <div className="meal-header">
        <input
          className="meal-name"
          type="text"
          value={name}
          onChange={(e) => onUpdateName(e.target.value)}
          placeholder="שם הארוחה"
          aria-label="שם הארוחה"
        />
        <button
          type="button"
          className="meal-remove"
          onClick={onRemove}
          aria-label="מחק ארוחה"
          title="מחק ארוחה"
        >
          ✖
        </button>
      </div>

      <div ref={mealExportRef}>
        {(personalProducts?.length ?? 0) > 0 && (
          <PersonalProductChips
            products={personalProducts!}
            onPick={handleChipPick}
            title="מהיר מהספרייה שלך"
          />
        )}
        <IngredientTable
          rows={rows}
          onPatchRow={patchRow}
          onRemoveRow={removeRow}
          onAddRow={addRow}
          onAnalyzeRow={analyzeRow}
          onNutritionEdit={handleNutritionEdit}
          addLabel="➕ הוסף מצרך לארוחה"
          hint={
            (personalProducts?.length ?? 0) > 0
              ? 'שם מוצר מהספרייה ממלא את השורה. עמודת ״קלוריות לכמות״ מסכמת לפי מה שהזנתם — לעריכת ערכים ל-100 ג׳ (חלבון וכו׳) השתמשו ב־▼.'
              : 'עמודת ״קלוריות לכמות״ לפי מה שהזנתם. לעריכת ערכים ל-100 ג׳ — כפתור ▼ בשורה.'
          }
          personalProducts={personalProducts}
          nameSuggestions={productNamesForSuggest}
        />

        <div className="meal-footer">
        <div className="meal-totals">
          <div className="meal-total-item">
            <span className="meal-total-label">סה"כ קלוריות</span>
            <strong>{roundCalories(total.calories)}</strong>
          </div>
          <div className="meal-total-item">
            <span className="meal-total-label">חלבון</span>
            <strong>{roundMacro(total.protein)} גרם</strong>
          </div>
          <div className="meal-total-item">
            <span className="meal-total-label">פחמימות</span>
            <strong>{roundMacro(total.carbohydrates)} גרם</strong>
          </div>
          <div className="meal-total-item">
            <span className="meal-total-label">שומן</span>
            <strong>{roundMacro(total.fat)} גרם</strong>
          </div>
          <div className="meal-total-item">
            <span className="meal-total-label">משקל</span>
            <strong>{Math.round(totalGrams)} גרם</strong>
          </div>
        </div>

        <div className="meal-export-row">
          {mealExportFlash && (
            <p className="meal-export-flash" role="status" aria-live="polite">
              {mealExportFlash}
            </p>
          )}
          <div className="meal-export-actions">
            <button
              type="button"
              className="ghost"
              disabled={!hasContent}
              onClick={() => void handleCopyMeal()}
            >
              העתק ארוחה (טקסט)
            </button>
            <button
              type="button"
              className="ghost"
              disabled={!hasContent}
              onClick={() => void handleShareMeal()}
            >
              שתף
            </button>
            <PdfExportButton
              targetRef={mealExportRef}
              filename={mealPdfName}
              disabled={!hasContent}
            />
          </div>
        </div>

        <button
          type="button"
          className="meal-add-to-daily"
          onClick={handleAdd}
          disabled={!hasContent}
          title={hasContent ? "הוסף את כל הארוחה ליום שלי" : "מלא לפחות מצרך אחד"}
        >
          ➕ הוסף ליום שלי
        </button>
        </div>
      </div>
    </div>
  );
}
