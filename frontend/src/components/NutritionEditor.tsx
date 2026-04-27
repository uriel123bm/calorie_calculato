import type { ChangeEvent } from "react";
import type { NutritionPer100g } from "../types";

interface Props {
  values: NutritionPer100g;
  onChange: (next: NutritionPer100g) => void;
}

const FIELDS: Array<{ key: keyof NutritionPer100g; label: string; unit: string }> = [
  { key: "calories", label: "קלוריות", unit: "קק\"ל" },
  { key: "protein", label: "חלבון", unit: "ג" },
  { key: "carbohydrates", label: "פחמימות", unit: "ג" },
  { key: "sugar", label: "סוכר", unit: "ג" },
  { key: "fat", label: "שומן", unit: "ג" },
  { key: "sodium", label: "נתרן", unit: "מ\"ג" },
];

export function NutritionEditor({ values, onChange }: Props) {
  const update =
    (key: keyof NutritionPer100g) => (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const num = raw === "" ? 0 : Number(raw);
      if (Number.isNaN(num)) return;
      onChange({ ...values, [key]: Math.max(num, 0) });
    };

  return (
    <div>
      <div className="editor-title">
        ערכים זוהו אוטומטית – ניתן לערוך (ל-100 גרם)
      </div>
      <div className="editor-grid">
        {FIELDS.map(({ key, label, unit }) => (
          <div key={key}>
            <label htmlFor={`nut-${key}`}>
              {label} ({unit})
            </label>
            <input
              id={`nut-${key}`}
              type="number"
              min={0}
              step="0.1"
              value={values[key]}
              onChange={update(key)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
