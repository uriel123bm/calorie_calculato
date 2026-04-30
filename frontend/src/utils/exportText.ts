import type {
  DailyTrackerState,
  IngredientRowState,
  NutritionPer100g,
} from "../types";

export function formatDailyJournalText(state: DailyTrackerState): string {
  const consumed = state.entries.reduce(
    (a, e) => ({
      cal: a.cal + e.calories,
      p: a.p + (e.protein ?? 0),
      c: a.c + (e.carbohydrates ?? 0),
      f: a.f + (e.fat ?? 0),
    }),
    { cal: 0, p: 0, c: 0, f: 0 }
  );

  const lines = [
    `מחשבון קלוריות — יום ${state.date}`,
    `יעד יומי: ${state.targetCalories} קלוריות`,
    `סה״כ נצרך: ${Math.round(consumed.cal)} קלוריות`,
    consumed.p > 0 ? `חלבון: ${consumed.p.toFixed(1)} גרם` : null,
    consumed.c > 0 ? `פחמימות: ${consumed.c.toFixed(1)} גרם` : null,
    consumed.f > 0 ? `שומן: ${consumed.f.toFixed(1)} גרם` : null,
    "",
    "רשימת פריטים:",
    ...state.entries.map(
      (e) =>
        `• ${e.name} — ${e.calories.toFixed(0)} קלוריות` +
        (e.protein ? `, חלבון ${e.protein.toFixed(1)} ג׳` : "")
    ),
  ].filter(Boolean) as string[];

  return lines.join("\n");
}

export function formatMealDraftText(
  mealName: string,
  rows: IngredientRowState[],
  total: NutritionPer100g,
  totalGrams: number
): string {
  const filled = rows.filter((r) => r.name.trim());
  const lines = [
    `ארוחה: ${mealName.trim() || "ללא שם"}`,
    "",
    "מצרכים:",
    ...filled.map((r) => {
      const q =
        r.quantity === "" ? "" : `${r.quantity} ${r.unit}`;
      const cal = Math.round(r.nutritionForQuantity.calories);
      return `• ${r.name.trim()} (${q}) — ${cal} קלוריות`;
    }),
    "",
    `סה״כ משוער: ${Math.round(total.calories)} קלוריות`,
    totalGrams > 0 ? `משקל משוער: ${Math.round(totalGrams)} גרם` : null,
    total.protein > 0 ? `חלבון: ${total.protein.toFixed(1)} גרם` : null,
    total.carbohydrates > 0
      ? `פחמימות: ${total.carbohydrates.toFixed(1)} גרם`
      : null,
    total.fat > 0 ? `שומן: ${total.fat.toFixed(1)} גרם` : null,
  ].filter(Boolean) as string[];

  return lines.join("\n");
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export async function shareTextIfPossible(
  title: string,
  text: string
): Promise<boolean> {
  if (
    typeof navigator !== "undefined" &&
    navigator.share &&
    typeof navigator.share === "function"
  ) {
    try {
      await navigator.share({ title, text });
      return true;
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return false;
    }
  }
  return false;
}
