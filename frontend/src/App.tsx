import { useCallback, useMemo, useRef, useState } from "react";
import { DailyTracker } from "./components/DailyTracker";
import { IngredientTable } from "./components/IngredientTable";
import { MealsSection } from "./components/MealsSection";
import { PdfExportButton } from "./components/PdfExportButton";
import { RecipeNameInput } from "./components/RecipeNameInput";
import { RecipeSummary } from "./components/RecipeSummary";
import { useDailyTracker } from "./hooks/useDailyTracker";
import { useIngredientRows } from "./hooks/useIngredientRows";
import { EMPTY_NUTRITION, NutritionPer100g } from "./types";

const FIELDS: (keyof NutritionPer100g)[] = [
  "calories",
  "protein",
  "carbohydrates",
  "sugar",
  "fat",
  "sodium",
];

const DEFAULT_ROW_COUNT = 4;

export default function App() {
  const [recipeName, setRecipeName] = useState("");
  const [servings, setServings] = useState(1);

  const recipe = useIngredientRows(DEFAULT_ROW_COUNT);
  const daily = useDailyTracker();

  const exportTargetRef = useRef<HTMLDivElement>(null);

  const perServing = useMemo<NutritionPer100g>(() => {
    if (servings <= 0) return { ...EMPTY_NUTRITION };
    return FIELDS.reduce((acc, k) => {
      acc[k] = recipe.total[k] / servings;
      return acc;
    }, {} as NutritionPer100g);
  }, [recipe.total, servings]);

  const filename = `${recipeName.trim() || "מתכון"}.pdf`;

  const hasFilledRows = recipe.rows.some(
    (r) => r.name.trim() && r.quantity && Number(r.quantity) > 0
  );

  const isDirty =
    recipeName.trim() !== "" ||
    servings !== 1 ||
    recipe.rows.length !== DEFAULT_ROW_COUNT ||
    recipe.rows.some(
      (r) => r.name.trim() !== "" || r.quantity !== "" || r.status !== "idle"
    );

  const handleReset = useCallback(() => {
    if (isDirty) {
      const ok = window.confirm("האם לנקות את כל הערכים ולהתחיל מתכון חדש?");
      if (!ok) return;
    }
    setRecipeName("");
    setServings(1);
    recipe.reset(DEFAULT_ROW_COUNT);
  }, [isDirty, recipe]);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>מחשבון קלוריות למתכונים</h1>
        <p>הכניסו מצרכים – הערכים התזונתיים יזוהו וחושבו אוטומטית.</p>
      </header>

      <div className="app-layout">
        <main className="app-main">
          <div ref={exportTargetRef}>
            <RecipeNameInput value={recipeName} onChange={setRecipeName} />

            <section className="section">
              <h2>רשימת מצרכים</h2>
              <IngredientTable
                rows={recipe.rows}
                onPatchRow={recipe.patchRow}
                onRemoveRow={recipe.removeRow}
                onAddRow={recipe.addRow}
                onAnalyzeRow={recipe.analyzeRow}
                onNutritionEdit={recipe.handleNutritionEdit}
              />
            </section>

            <RecipeSummary
              recipeName={recipeName}
              servings={servings}
              totalWeightG={recipe.totalGrams}
              total={recipe.total}
              per100g={recipe.per100g}
              perServing={perServing}
              onServingsChange={setServings}
            />
          </div>

          <div className="actions-bar">
            <button
              type="button"
              className="ghost"
              onClick={handleReset}
              disabled={!isDirty}
              title="ניקוי כל הערכים והתחלת מתכון חדש"
            >
              מתכון חדש
            </button>
            <PdfExportButton
              targetRef={exportTargetRef}
              filename={filename}
              disabled={!hasFilledRows}
            />
          </div>

          <MealsSection onAddToDaily={daily.addEntry} />
        </main>

        <div className="app-side">
          <DailyTracker
            state={daily.state}
            setTarget={daily.setTarget}
            addEntry={daily.addEntry}
            removeEntry={daily.removeEntry}
            resetDay={daily.resetDay}
            currentRecipeName={recipeName}
            perServing={perServing}
            recipeServings={servings}
            hasRecipeData={hasFilledRows && recipe.total.calories > 0}
          />
        </div>
      </div>
    </div>
  );
}
