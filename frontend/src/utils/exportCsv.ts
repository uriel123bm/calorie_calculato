import type { IngredientRowState, NutritionPer100g } from "../types";

function escapeCsv(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function row(...cells: (string | number)[]): string {
  return cells.map(escapeCsv).join(",");
}

/**
 * Build a CSV string for a recipe and trigger a browser download.
 */
export function exportRecipeCsv(
  rows: IngredientRowState[],
  total: NutritionPer100g,
  per100g: NutritionPer100g,
  perServing: NutritionPer100g,
  recipeName: string,
  servings: number
): void {
  const name = recipeName.trim() || "מתכון";
  const lines: string[] = [];

  lines.push(row("מתכון", name));
  lines.push(row("מנות", servings));
  lines.push("");

  lines.push(row("מצרך", "כמות (גרם)", "קלוריות", "חלבון (גרם)", "פחמימות (גרם)", "שומן (גרם)"));
  for (const r of rows) {
    if (!r.name.trim() || r.status === "idle") continue;
    lines.push(
      row(
        r.name,
        r.quantityInGrams.toFixed(1),
        r.nutritionForQuantity.calories.toFixed(0),
        r.nutritionForQuantity.protein.toFixed(1),
        r.nutritionForQuantity.carbohydrates.toFixed(1),
        r.nutritionForQuantity.fat.toFixed(1)
      )
    );
  }

  lines.push("");
  lines.push(row("", "קלוריות", "חלבון (גרם)", "פחמימות (גרם)", "שומן (גרם)"));
  lines.push(
    row(
      "סה\"כ למתכון",
      total.calories.toFixed(0),
      total.protein.toFixed(1),
      total.carbohydrates.toFixed(1),
      total.fat.toFixed(1)
    )
  );
  lines.push(
    row(
      "ל-100 גרם",
      per100g.calories.toFixed(0),
      per100g.protein.toFixed(1),
      per100g.carbohydrates.toFixed(1),
      per100g.fat.toFixed(1)
    )
  );
  lines.push(
    row(
      "למנה",
      perServing.calories.toFixed(0),
      perServing.protein.toFixed(1),
      perServing.carbohydrates.toFixed(1),
      perServing.fat.toFixed(1)
    )
  );

  // BOM for Excel Hebrew support
  const bom = "\uFEFF";
  const csv = bom + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
