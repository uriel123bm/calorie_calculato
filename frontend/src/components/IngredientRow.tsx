import type { ChangeEvent, KeyboardEvent } from "react";
import { NUTRITION_SOURCE_BADGES } from "../constants/nutritionSourceBadges";
import type {
  HebrewUnit,
  IngredientRowState,
  NutritionPer100g,
  UserProduct,
} from "../types";
import { UNITS } from "../types";
import {
  findPersonalProductByName,
  personalProductToIngredientPer100g,
} from "../utils/personalProductMatch";
import { NutritionEditor } from "./NutritionEditor";

interface Props {
  row: IngredientRowState;
  onChange: (patch: Partial<IngredientRowState>) => void;
  onRemove: () => void;
  onAnalyze: () => void;
  onNutritionEdit: (next: NutritionPer100g) => void;
  canRemove: boolean;
  /** Saved personal products — typing the exact name fills the row like a mini-recipe. */
  personalProducts?: UserProduct[];
  rowIndex: number;
  isLastRow: boolean;
  onSubmitLastRow?: () => void;
  nameSuggestionsId?: string;
}

const SOURCE_LABEL = NUTRITION_SOURCE_BADGES;

export function IngredientRow({
  row,
  onChange,
  onRemove,
  onAnalyze,
  onNutritionEdit,
  canRemove,
  personalProducts,
  rowIndex,
  isLastRow,
  onSubmitLastRow,
  nameSuggestionsId,
}: Props) {
  const focusByKey = (focusKey: string) => {
    const target = document.querySelector<HTMLElement>(
      `[data-row-idx="${rowIndex}"][data-focus-key="${focusKey}"]`
    );
    target?.focus();
  };

  const goToNextRowName = () => {
    const target = document.querySelector<HTMLElement>(
      `[data-row-idx="${rowIndex + 1}"][data-focus-key="name"]`
    );
    if (target) {
      target.focus();
      return;
    }
    if (isLastRow && onSubmitLastRow) {
      onSubmitLastRow();
      window.setTimeout(() => {
        const appended = document.querySelector<HTMLElement>(
          `[data-row-idx="${rowIndex + 1}"][data-focus-key="name"]`
        );
        appended?.focus();
      }, 0);
    }
  };

  const handleEnterNext = (e: KeyboardEvent<HTMLElement>, nextKey: string) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (nextKey === "__next_row__") {
      goToNextRowName();
      return;
    }
    focusByKey(nextKey);
  };

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ name: e.target.value });
  };

  const handleNameBlur = () => {
    const trimmed = row.name.trim();
    if (!trimmed) return;

    const libs = personalProducts?.length ? personalProducts : [];
    const hit = findPersonalProductByName(trimmed, libs);
    if (hit) {
      const per100 = personalProductToIngredientPer100g(hit);
      onChange({
        name: hit.name,
        nutritionPer100g: per100,
        quantity: 1,
        unit: "יחידה",
        manualEdit: true,
        source: "personal_library",
        status: "ready",
        confidence: 1,
        matchedName: hit.name,
      });
      return;
    }

    if (row.quantity && Number(row.quantity) > 0) {
      onAnalyze();
    }
  };

  const handleQuantityChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "") {
      onChange({ quantity: "" });
      return;
    }
    // Always store as a number so downstream math is stable.
    // Replace comma decimal separator (Hebrew keyboards) with dot.
    const normalised = val.replace(",", ".");
    const num = Number(normalised);
    if (Number.isFinite(num) && num >= 0) {
      onChange({ quantity: num });
    }
  };

  const handleQuantityBlur = () => {
    if (!row.name.trim() || !row.quantity || Number(row.quantity) <= 0) return;
    if (row.status === "ready") {
      if (row.source === "personal_library") return;
      if (row.manualEdit && row.source === "manual") return;
      if (row.unit === "יחידה") return;
    }
    onAnalyze();
  };

  const handleUnitChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const unit = e.target.value as HebrewUnit;
    const patch: Partial<IngredientRowState> = { unit };
    if (unit !== "יחידה") {
      patch.unitWeightG = undefined;
    }
    onChange(patch);
    if (row.name.trim() && row.quantity && Number(row.quantity) > 0) {
      setTimeout(onAnalyze, 0);
    }
  };

  const handleUnitWeightChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "") {
      onChange({ unitWeightG: undefined });
      return;
    }
    const normalised = raw.replace(",", ".");
    const num = Number(normalised);
    if (Number.isFinite(num) && num > 0) {
      onChange({ unitWeightG: num });
    }
  };

  const handleCalEdit = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const num = raw === "" ? 0 : Number(raw);
    if (Number.isNaN(num)) return;
    const next = { ...row.nutritionPer100g, calories: Math.max(num, 0) };
    onNutritionEdit(next);
  };

  const sourceMeta = row.source ? SOURCE_LABEL[row.source] : null;
  const confidencePct = Math.round(row.confidence * 100);

  return (
    <>
      <tr className={row.status === "loading" ? "ingredient-row-loading" : undefined}>
        <td className="col-name">
          <div className="cell-with-meta">
            <input
              type="text"
              placeholder={`לדוגמה: ${row.placeholder ?? "פתיבר"}`}
              value={row.name}
              onChange={handleNameChange}
              onBlur={handleNameBlur}
              onKeyDown={(e) => handleEnterNext(e, "unit")}
              aria-label="שם מצרך"
              data-row-idx={rowIndex}
              data-focus-key="name"
              list={nameSuggestionsId}
            />
            {row.status === "loading" && (
              <span className="meta-line">
                <span className="loading-skeleton-line" />
              </span>
            )}
            {row.status === "ready" && sourceMeta && (
              <span className="meta-line">
                <span className={`badge ${sourceMeta.cls}`}>
                  {sourceMeta.label}
                </span>
                {row.confidence > 0 && <span>ביטחון: {confidencePct}%</span>}
                {row.matchedName && row.matchedName !== row.name && (
                  <span>({row.matchedName})</span>
                )}
              </span>
            )}
            {row.status === "error" && (
              <span className="meta-line">
                <span className="badge error">שגיאה</span>
                {row.error && <span className="error-text">{row.error}</span>}
              </span>
            )}
            {row.manualEdit && row.status === "ready" && row.source !== "personal_library" && (
              <span className="meta-line">
                <span className="badge manual">ערוך ידנית</span>
              </span>
            )}
          </div>
        </td>
        <td className="col-unit">
          <select
            value={row.unit}
            onChange={handleUnitChange}
            onKeyDown={(e) =>
              handleEnterNext(e, "quantity")
            }
            aria-label="יחידת מידה"
            data-row-idx={rowIndex}
            data-focus-key="unit"
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </td>
        <td className="col-qty">
          <input
            type="number"
            min={0}
            step="0.1"
            value={row.quantity === "" ? "" : row.quantity}
            onChange={handleQuantityChange}
            onBlur={handleQuantityBlur}
            onKeyDown={(e) =>
              handleEnterNext(e, row.unit === "יחידה" ? "unitWeight" : "calories")
            }
            aria-label="כמות"
            data-row-idx={rowIndex}
            data-focus-key="quantity"
          />
        </td>
        <td className="col-unit-weight">
          {row.unit === "יחידה" ? (
            <div className="unit-weight-cell">
              <input
                type="number"
                min={0.1}
                step="any"
                inputMode="decimal"
                className="unit-weight-input"
                placeholder="ברירת מחדל 100"
                aria-label="משקל ליחידה בגרם"
                title="כמה גרם במנה אחת — למשל ביצה ~55 גרם, תפוח ~180 גרם"
                value={
                  row.unitWeightG !== undefined && row.unitWeightG > 0
                    ? row.unitWeightG
                    : ""
                }
                onChange={handleUnitWeightChange}
                onKeyDown={(e) => handleEnterNext(e, "calories")}
                data-row-idx={rowIndex}
                data-focus-key="unitWeight"
              />
              {row.quantityInGrams > 0 && (
                <span className="unit-weight-hint">
                  סה״כ משקל ≈ {Math.round(row.quantityInGrams)} גרם
                </span>
              )}
            </div>
          ) : (
            <span className="unit-weight-dash" aria-hidden="true">
              —
            </span>
          )}
        </td>
        <td className="col-cal100">
          <input
            type="number"
            min={0}
            step="1"
            value={row.nutritionPer100g.calories}
            onChange={handleCalEdit}
            onKeyDown={(e) => handleEnterNext(e, "__next_row__")}
            aria-label="קלוריות ל-100 גרם"
            data-row-idx={rowIndex}
            data-focus-key="calories"
          />
        </td>
        <td className="col-total">
          {row.status === "loading" ? (
            <span className="loading-skeleton-chip" aria-label="טוען" />
          ) : (
            `${row.nutritionForQuantity.calories.toFixed(0)} קלוריות`
          )}
        </td>
        <td className="col-actions">
          <button
            type="button"
            className="row-icon-button"
            onClick={() => onChange({ showEditor: !row.showEditor })}
            aria-label={row.showEditor ? "הסתר ערכים" : "ערוך ערכים"}
            title={row.showEditor ? "הסתר ערכים" : "ערוך ערכים"}
          >
            {row.showEditor ? "▲" : "▼"}
          </button>
          <button
            type="button"
            className="row-icon-button"
            onClick={onRemove}
            disabled={!canRemove}
            aria-label="מחק שורה"
            title="מחק שורה"
          >
            ✕
          </button>
        </td>
      </tr>
      {row.showEditor && (
        <tr className="editor-row">
          <td colSpan={7}>
            <NutritionEditor
              values={row.nutritionPer100g}
              onChange={onNutritionEdit}
            />
          </td>
        </tr>
      )}
    </>
  );
}
