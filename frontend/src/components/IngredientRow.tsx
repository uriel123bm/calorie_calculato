import type { ChangeEvent } from "react";
import type { HebrewUnit, IngredientRowState, NutritionPer100g } from "../types";
import { UNITS } from "../types";
import { NutritionEditor } from "./NutritionEditor";

interface Props {
  row: IngredientRowState;
  onChange: (patch: Partial<IngredientRowState>) => void;
  onRemove: () => void;
  onAnalyze: () => void;
  onNutritionEdit: (next: NutritionPer100g) => void;
  canRemove: boolean;
}

const SOURCE_LABEL: Record<string, { label: string; cls: string }> = {
  local: { label: "מאגר מקומי", cls: "local" },
  openfoodfacts: { label: "Open Food Facts", cls: "openfoodfacts" },
  ai_estimate: { label: "הערכת AI", cls: "ai" },
  manual: { label: "עריכה ידנית", cls: "manual" },
  unknown: { label: "לא נמצא", cls: "unknown" },
};

export function IngredientRow({
  row,
  onChange,
  onRemove,
  onAnalyze,
  onNutritionEdit,
  canRemove,
}: Props) {
  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ name: e.target.value });
  };

  const handleNameBlur = () => {
    if (row.name.trim() && row.quantity && Number(row.quantity) > 0) {
      onAnalyze();
    }
  };

  const handleQuantityChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "") {
      onChange({ quantity: "" });
    } else {
      const num = Number(val);
      if (!Number.isNaN(num) && num >= 0) onChange({ quantity: num });
    }
  };

  const handleQuantityBlur = () => {
    if (row.name.trim() && row.quantity && Number(row.quantity) > 0) {
      onAnalyze();
    }
  };

  const handleUnitChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const unit = e.target.value as HebrewUnit;
    onChange({ unit });
    if (row.name.trim() && row.quantity && Number(row.quantity) > 0) {
      setTimeout(onAnalyze, 0);
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
      <tr>
        <td className="col-name">
          <div className="cell-with-meta">
            <input
              type="text"
              placeholder={`לדוגמה: ${row.placeholder ?? "פתיבר"}`}
              value={row.name}
              onChange={handleNameChange}
              onBlur={handleNameBlur}
              aria-label="שם מצרך"
            />
            {row.status === "loading" && (
              <span className="meta-line">מזהה ערכים…</span>
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
            {row.manualEdit && row.status === "ready" && (
              <span className="meta-line">
                <span className="badge manual">ערוך ידנית</span>
              </span>
            )}
          </div>
        </td>
        <td className="col-qty">
          <input
            type="number"
            min={0}
            step="0.1"
            value={row.quantity === "" ? "" : row.quantity}
            onChange={handleQuantityChange}
            onBlur={handleQuantityBlur}
            aria-label="כמות"
          />
        </td>
        <td className="col-unit">
          <select
            value={row.unit}
            onChange={handleUnitChange}
            aria-label="יחידת מידה"
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </td>
        <td className="col-cal100">
          <input
            type="number"
            min={0}
            step="1"
            value={row.nutritionPer100g.calories}
            onChange={handleCalEdit}
            aria-label="קלוריות ל-100 גרם"
          />
        </td>
        <td className="col-total">
          {row.nutritionForQuantity.calories.toFixed(0)} קק"ל
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
          <td colSpan={6}>
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
