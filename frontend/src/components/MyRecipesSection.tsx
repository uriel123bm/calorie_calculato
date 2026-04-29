import { useState } from "react";
import type { DailyEntryInput, SavedRecipe } from "../types";
import { scaleNutrition } from "../utils/nutritionMath";
import { roundCalories, roundMacro } from "../utils/nutritionRounding";

interface Props {
  recipes: SavedRecipe[];
  onDeleteRecipe: (id: string) => void;
  onAddToDaily: (input: DailyEntryInput) => void;
}

function RecipeCard({
  recipe,
  onDelete,
  onAddToDaily,
}: {
  recipe: SavedRecipe;
  onDelete: () => void;
  onAddToDaily: (input: DailyEntryInput) => void;
}) {
  const [grams, setGrams] = useState<number | "">(100);
  const [added, setAdded] = useState(false);

  const gramsNum = typeof grams === "number" ? grams : 0;
  const preview = gramsNum > 0 ? scaleNutrition(recipe.per100g, gramsNum) : null;

  const handleAdd = () => {
    if (!preview || gramsNum <= 0) return;
    onAddToDaily({
      name: `${recipe.name} (${gramsNum} גרם)`,
      calories: roundCalories(preview.calories),
      protein: roundMacro(preview.protein),
      carbohydrates: roundMacro(preview.carbohydrates),
      fat: roundMacro(preview.fat),
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const savedDate = new Date(recipe.savedAt).toLocaleDateString("he-IL", {
    day: "numeric", month: "short",
  });

  return (
    <div className="my-recipe-card">
      <div className="my-recipe-header">
        <div className="my-recipe-title-row">
          <span className="material-symbols-outlined my-recipe-icon">menu_book</span>
          <div>
            <h3 className="my-recipe-name">{recipe.name}</h3>
            <span className="my-recipe-meta">
              נשמר {savedDate} · {Math.round(recipe.totalWeightG)} גרם סה"כ
            </span>
          </div>
        </div>
        <button
          type="button"
          className="row-icon-button"
          onClick={onDelete}
          title="מחק מתכון"
          aria-label={`מחק ${recipe.name}`}
        >✕</button>
      </div>

      {/* per-100g summary */}
      <div className="my-recipe-per100">
        <span>ל-100 גרם:</span>
        <span className="badge calories">{Math.round(recipe.per100g.calories)} קלוריות</span>
        <span className="badge protein">חלבון {recipe.per100g.protein.toFixed(1)} גרם</span>
        <span className="badge fat">שומן {recipe.per100g.fat.toFixed(1)} גרם</span>
      </div>

      {/* portion calculator */}
      <div className="my-recipe-portion-row">
        <label className="my-recipe-portion-label">כמה גרם אכלת?</label>
        <div className="my-recipe-portion-inputs">
          <input
            type="number"
            min={0}
            step={10}
            value={grams === "" ? "" : grams}
            onChange={(e) => setGrams(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
            className="portion-input"
            aria-label="כמות בגרם"
          />
          <span className="portion-unit">גרם</span>
        </div>

        {preview && gramsNum > 0 && (
          <div className="my-recipe-preview">
            <span className="preview-cal">{Math.round(preview.calories)} קלוריות</span>
            {preview.protein > 0 && <span className="preview-prot">חלבון {preview.protein.toFixed(1)} גרם</span>}
          </div>
        )}

        <button
          type="button"
          className={`primary${added ? " added" : ""}`}
          onClick={handleAdd}
          disabled={gramsNum <= 0 || added}
        >
          {added
            ? <><span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: "middle" }}>check_circle</span> נוסף!</>
            : <><span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: "middle", marginLeft: 4 }}>add_circle</span> הוסף ליומן</>
          }
        </button>
      </div>
    </div>
  );
}

export function MyRecipesSection({ recipes, onDeleteRecipe, onAddToDaily }: Props) {
  if (recipes.length === 0) {
    return (
      <div className="section">
        <h2>
          <span className="material-symbols-outlined">bookmark</span>
          המתכונים שלי
        </h2>
        <div className="my-recipes-empty">
          <span className="material-symbols-outlined" style={{ fontSize: 44, opacity: 0.3 }}>menu_book</span>
          <p>עדיין אין מתכונים שמורים.</p>
          <p className="hint">עברו ל<strong>מתכון</strong>, הכינו מתכון ולחצו <strong>שמור מתכון</strong>.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      <h2>
        <span className="material-symbols-outlined">bookmark</span>
        המתכונים שלי ({recipes.length})
      </h2>
      <div className="my-recipes-list">
        {recipes.map((r) => (
          <RecipeCard
            key={r.id}
            recipe={r}
            onDelete={() => onDeleteRecipe(r.id)}
            onAddToDaily={onAddToDaily}
          />
        ))}
      </div>
    </div>
  );
}
