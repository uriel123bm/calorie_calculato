import { useCallback, useState } from "react";
import type { DailyEntryInput, Meal as MealType } from "../types";
import { Meal } from "./Meal";

interface Props {
  onAddToDaily: (input: DailyEntryInput) => void;
}

const DEFAULT_NAMES = ["ארוחת בוקר", "ארוחת צהריים", "ארוחת ערב", "נשנוש"];

function makeMealId(): string {
  return Math.random().toString(36).slice(2, 11);
}

export function MealsSection({ onAddToDaily }: Props) {
  const [meals, setMeals] = useState<MealType[]>(() => [
    { id: makeMealId(), name: "ארוחת בוקר" },
  ]);

  const handleAddMeal = useCallback(() => {
    setMeals((prev) => {
      const fallback = DEFAULT_NAMES[prev.length % DEFAULT_NAMES.length];
      return [...prev, { id: makeMealId(), name: fallback }];
    });
  }, []);

  const handleUpdateName = useCallback((id: string, name: string) => {
    setMeals((prev) => prev.map((m) => (m.id === id ? { ...m, name } : m)));
  }, []);

  const handleRemoveMeal = useCallback((id: string) => {
    setMeals((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return (
    <section className="section meals-section">
      <div className="section-header">
        <h2>ארוחות</h2>
        <p className="section-subtitle">
          הגדירו ארוחה (כמו ארוחת בוקר), הוסיפו את המצרכים שלה והוסיפו אותה
          בלחיצה ליעד היומי שלכם.
        </p>
      </div>

      <div className="meals-list">
        {meals.length === 0 ? (
          <div className="meals-empty">עדיין לא הגדרתם ארוחה. לחצו "הוסף ארוחה" כדי להתחיל.</div>
        ) : (
          meals.map((meal) => (
            <Meal
              key={meal.id}
              id={meal.id}
              name={meal.name}
              onUpdateName={(name) => handleUpdateName(meal.id, name)}
              onRemove={() => handleRemoveMeal(meal.id)}
              onAddToDaily={onAddToDaily}
            />
          ))
        )}
      </div>

      <div className="toolbar">
        <button type="button" onClick={handleAddMeal} className="meal-add-btn">
          ➕ הוסף ארוחה
        </button>
      </div>
    </section>
  );
}
