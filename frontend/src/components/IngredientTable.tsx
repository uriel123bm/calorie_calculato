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
  const hintId = useId();

  return (
    <div className="ingredient-table-wrap">
      <datalist id={suggestionsId}>
        {(nameSuggestions ?? []).map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <table
        className="ingredient-table"
        aria-describedby={hint ? hintId : undefined}
      >
        <caption className="sr-only">
          טבלת מצרכים: שם המזון, יחידת מידה, כמות, ומשקל ליחידה בגרם כשמודדים
          ביחידות. עמודת הקלוריות מציגה סיכום לפי הכמות שהוזנה. לעריכת ערכים
          תזונתיים ל-100 גרם השתמשו בכפתור ההרחבה בשורה.
        </caption>
        <colgroup>
          <col className="ingredient-col ingredient-col-name" />
          <col className="ingredient-col ingredient-col-unit" />
          <col className="ingredient-col ingredient-col-qty" />
          <col className="ingredient-col ingredient-col-unit-weight" />
          <col className="ingredient-col ingredient-col-total" />
          <col className="ingredient-col ingredient-col-actions" />
        </colgroup>
        <thead>
          <tr>
            <th className="col-name" scope="col">
              שם מצרך
            </th>
            <th className="col-unit" scope="col">
              יחידה
            </th>
            <th className="col-qty" scope="col">
              כמות
            </th>
            <th
              className="col-unit-weight"
              scope="col"
              title="כשנבחרת יחידת ״יחידה״ — משקל יחידה אחת בגרם"
            >
              משקל יחידה
              <span className="col-unit-weight-sub">גרם</span>
            </th>
            <th className="col-total" scope="col">
              קלוריות לכמות
            </th>
            <th className="col-actions" scope="col" aria-label="פעולות">
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
        <button type="button" onClick={onAddRow} aria-label="הוספת מצרך חדש לרשימה">
          {addLabel}
        </button>
        {hint && (
          <span id={hintId} className="empty-hint">
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}
