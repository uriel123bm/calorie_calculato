import type { ChangeEvent } from "react";
import { forwardRef } from "react";
import type { NutritionPer100g } from "../types";

interface Props {
  recipeName: string;
  servings: number;
  totalWeightG: number;
  total: NutritionPer100g;
  per100g: NutritionPer100g;
  perServing: NutritionPer100g;
  onServingsChange: (n: number) => void;
}

const FIELDS: Array<{
  key: keyof NutritionPer100g;
  label: string;
  unit: string;
  digits: number;
}> = [
  { key: "calories", label: "קלוריות", unit: "קלוריות", digits: 0 },
  { key: "protein", label: "חלבון", unit: "גרם", digits: 1 },
  { key: "carbohydrates", label: "פחמימות", unit: "גרם", digits: 1 },
  { key: "sugar", label: "סוכר", unit: "גרם", digits: 1 },
  { key: "fat", label: "שומן", unit: "גרם", digits: 1 },
  { key: "sodium", label: "נתרן", unit: "מ\"ג", digits: 0 },
];

function NutritionList({ values }: { values: NutritionPer100g }) {
  return (
    <dl>
      {FIELDS.map(({ key, label, unit, digits }) => (
        <div key={key} style={{ display: "contents" }}>
          <dt>{label}</dt>
          <dd>
            {values[key].toFixed(digits)} {unit}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export const RecipeSummary = forwardRef<HTMLElement, Props>(function RecipeSummary(
  {
    recipeName,
    servings,
    totalWeightG,
    total,
    per100g,
    perServing,
    onServingsChange,
  },
  ref
) {
  const handleServings = (e: ChangeEvent<HTMLInputElement>) => {
    const num = Number(e.target.value);
    if (!Number.isNaN(num) && num >= 1) onServingsChange(Math.floor(num));
  };

  const totalCalories = total.calories.toFixed(0);

  return (
    <section className="section" ref={ref} id="recipe-summary">
      <h2>סיכום המתכון{recipeName ? ` – ${recipeName}` : ""}</h2>

      <div className="servings-row">
        <label htmlFor="servings-input">מספר מנות:</label>
        <input
          id="servings-input"
          type="number"
          min={1}
          step={1}
          value={servings}
          onChange={handleServings}
        />
        <span className="empty-hint">
          משקל כולל: {totalWeightG.toFixed(0)} גרם
        </span>
      </div>

      <p className="total-headline">
        סה"כ קלוריות למתכון: {totalCalories} קלוריות
      </p>

      <div className="summary-grid">
        <div className="summary-card">
          <h3>סה"כ למתכון</h3>
          <NutritionList values={total} />
        </div>
        <div className="summary-card">
          <h3>ערכים ל-100 גרם</h3>
          <NutritionList values={per100g} />
        </div>
        <div className="summary-card">
          <h3>ערכים למנה</h3>
          <NutritionList values={perServing} />
        </div>
      </div>
    </section>
  );
});
