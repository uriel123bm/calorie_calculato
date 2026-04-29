import { useId } from "react";
import type { IngredientRowState, NutritionPer100g, UserProduct } from "../types";
import { IngredientRow } from "./IngredientRow";

interface Props {
  rows: IngredientRowState[];
  onPatchRow: (id: string, patch: Partial<IngredientRowState>) => void;
  onRemoveRow: (id: string) => void;
  onAddRow: () => void;
  onAnalyzeRow: (id: string) => void;
  onNutritionEdit: (id: string, next: NutritionPer100g) => void;
  hint?: string;
  addLabel?: string;
  personalProducts?: UserProduct[];
  onSubmitLastRow?: () => void;
  nameSuggestions?: string[];
}

export function IngredientTable({
  rows,
  onPatchRow,
  onRemoveRow,
  onAddRow,
  onAnalyzeRow,
  onNutritionEdit,
  hint,
  addLabel = "➕ הוסף מצרך",
  personalProducts,
  onSubmitLastRow,
  nameSuggestions,
}: Props) {
  const suggestionsId = useId();
  return (
    <div className="ingredient-table-wrap">
      <datalist id={suggestionsId}>
        {(nameSuggestions ?? []).map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <table className="ingredient-table">
        <colgroup>
          <col className="ingredient-col ingredient-col-name" />
          <col className="ingredient-col ingredient-col-unit" />
          <col className="ingredient-col ingredient-col-qty" />
          <col className="ingredient-col ingredient-col-unit-weight" />
          <col className="ingredient-col ingredient-col-cal100" />
          <col className="ingredient-col ingredient-col-total" />
          <col className="ingredient-col ingredient-col-actions" />
        </colgroup>
        <thead>
          <tr>
            <th className="col-name">שם מצרך</th>
            <th className="col-unit">יחידת מידה</th>
            <th className="col-qty">כמות</th>
            <th className="col-unit-weight" title="רלוונטי כשמודדים ביחידות (ביצה, פרי…)">
              משקל יחידה
              <span className="col-unit-weight-sub">גרם</span>
            </th>
            <th className="col-cal100">קלוריות ל-100 גרם</th>
            <th className="col-total">סה"כ קלוריות למרכיב</th>
            <th className="col-actions" aria-label="פעולות">
              <span className="ingredient-actions-head" aria-hidden="true">
                &#8943;
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <IngredientRow
              key={row.id}
              row={row}
              onChange={(patch) => onPatchRow(row.id, patch)}
              onRemove={() => onRemoveRow(row.id)}
              onAnalyze={() => onAnalyzeRow(row.id)}
              onNutritionEdit={(next) => onNutritionEdit(row.id, next)}
              canRemove={rows.length > 1}
              personalProducts={personalProducts}
              rowIndex={index}
              isLastRow={index === rows.length - 1}
              onSubmitLastRow={onSubmitLastRow}
              nameSuggestionsId={suggestionsId}
            />
          ))}
        </tbody>
      </table>
      <div className="toolbar">
        <button type="button" onClick={onAddRow}>
          {addLabel}
        </button>
        {hint && <span className="empty-hint">{hint}</span>}
      </div>
    </div>
  );
}
