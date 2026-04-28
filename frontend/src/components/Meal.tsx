import { useMemo } from "react";
import { useIngredientRows } from "../hooks/useIngredientRows";
import type { DailyEntryInput } from "../types";
import { roundCalories, roundMacro } from "../utils/nutritionRounding";
import { IngredientTable } from "./IngredientTable";

interface Props {
  id: string;
  name: string;
  onUpdateName: (name: string) => void;
  onRemove: () => void;
  onAddToDaily: (input: DailyEntryInput) => void;
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
      calories: roundCalories(total.calories),
      protein: roundMacro(total.protein),
      carbohydrates: roundMacro(total.carbohydrates),
      fat: roundMacro(total.fat),
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
            <strong>{roundCalories(total.calories)}</strong>
          </div>
          <div className="meal-total-item">
            <span className="meal-total-label">חלבון</span>
            <strong>{roundMacro(total.protein)} ג'</strong>
          </div>
          <div className="meal-total-item">
            <span className="meal-total-label">פחמימות</span>
            <strong>{roundMacro(total.carbohydrates)} ג'</strong>
          </div>
          <div className="meal-total-item">
            <span className="meal-total-label">שומן</span>
            <strong>{roundMacro(total.fat)} ג'</strong>
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
