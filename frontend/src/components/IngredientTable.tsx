import type { IngredientRowState, NutritionPer100g } from "../types";
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
}: Props) {
  return (
    <div className="ingredient-table-wrap">
      <table className="ingredient-table">
        <thead>
          <tr>
            <th className="col-name">שם מצרך</th>
            <th className="col-qty">כמות</th>
            <th className="col-unit">יחידת מידה</th>
            <th className="col-cal100">קלוריות ל-100 גרם</th>
            <th className="col-total">סה"כ קלוריות למרכיב</th>
            <th className="col-actions" aria-label="פעולות"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <IngredientRow
              key={row.id}
              row={row}
              onChange={(patch) => onPatchRow(row.id, patch)}
              onRemove={() => onRemoveRow(row.id)}
              onAnalyze={() => onAnalyzeRow(row.id)}
              onNutritionEdit={(next) => onNutritionEdit(row.id, next)}
              canRemove={rows.length > 1}
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
