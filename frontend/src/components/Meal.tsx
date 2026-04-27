import { useMemo } from "react";
import { useIngredientRows } from "../hooks/useIngredientRows";
import type { DailyEntryInput } from "../types";
import { IngredientTable } from "./IngredientTable";

interface Props {
  id: string;
  name: string;
  onUpdateName: (name: string) => void;
  onRemove: () => void;
  onAddToDaily: (input: DailyEntryInput) => void;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function Meal({ name, onUpdateName, onRemove, onAddToDaily }: Props) {
  const {
    rows,
    patchRow,
    addRow,
    removeRow,
    analyzeRow,
    handleNutritionEdit,
    total,
    totalGrams,
  } = useIngredientRows(3);

  const hasContent = useMemo(
    () => rows.some((r) => r.name.trim() && r.quantityInGrams > 0),
    [rows]
  );

  const handleAdd = () => {
    if (!hasContent) return;
    onAddToDaily({
      name: name.trim() || "ארוחה",
      calories: Math.round(total.calories),
      protein: round1(total.protein),
      carbohydrates: round1(total.carbohydrates),
      fat: round1(total.fat),
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

      <IngredientTable
        rows={rows}
        onPatchRow={patchRow}
        onRemoveRow={removeRow}
        onAddRow={addRow}
        onAnalyzeRow={analyzeRow}
        onNutritionEdit={handleNutritionEdit}
        addLabel="➕ הוסף מצרך לארוחה"
      />

      <div className="meal-footer">
        <div className="meal-totals">
          <div className="meal-total-item">
            <span className="meal-total-label">סה"כ קלוריות</span>
            <strong>{Math.round(total.calories)}</strong>
          </div>
          <div className="meal-total-item">
            <span className="meal-total-label">חלבון</span>
            <strong>{round1(total.protein)} ג'</strong>
          </div>
          <div className="meal-total-item">
            <span className="meal-total-label">פחמימות</span>
            <strong>{round1(total.carbohydrates)} ג'</strong>
          </div>
          <div className="meal-total-item">
            <span className="meal-total-label">שומן</span>
            <strong>{round1(total.fat)} ג'</strong>
          </div>
          <div className="meal-total-item">
            <span className="meal-total-label">משקל</span>
            <strong>{Math.round(totalGrams)} ג'</strong>
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
  );
}
