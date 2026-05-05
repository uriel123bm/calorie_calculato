import { useCallback, useEffect, useState } from "react";
import { schedulePush, subscribeSyncRefreshed } from "../services/sync";
import type { DailyEntryInput, Meal as MealType, UserProduct } from "../types";
import { generateId } from "../utils/id";
import { Meal } from "./Meal";

interface Props {
  userId: string;
  onAddToDaily: (input: DailyEntryInput) => void;
  personalProducts?: UserProduct[];
}

const DEFAULT_NAMES = ["ארוחת בוקר", "ארוחת צהריים", "ארוחת ערב", "נשנוש"];

const storageKey = (uid: string) => `user_${uid}:meals:v1`;

function makeMealId(): string {
  return generateId("meal_");
}

function defaultMeals(): MealType[] {
  return [{ id: makeMealId(), name: "ארוחת בוקר" }];
}

function isMeal(x: unknown): x is MealType {
  return (
    x !== null &&
    typeof x === "object" &&
    typeof (x as MealType).id === "string" &&
    typeof (x as MealType).name === "string"
  );
}

function loadMeals(uid: string): MealType[] {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return defaultMeals();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultMeals();
    const meals = parsed.filter(isMeal);
    return meals.length > 0 ? meals : defaultMeals();
  } catch {
    return defaultMeals();
  }
}

function saveMeals(uid: string, meals: MealType[]): void {
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(meals));
    window.dispatchEvent(new CustomEvent("meals:updated", { detail: { userId: uid } }));
  } catch { /* ignore */ }
}

export function MealsSection({ userId, onAddToDaily, personalProducts }: Props) {
  const [meals, setMeals] = useState<MealType[]>(() => loadMeals(userId));
  const [newMealName, setNewMealName] = useState("");

  useEffect(() => {
    setMeals(loadMeals(userId));
  }, [userId]);

  useEffect(
    () =>
      subscribeSyncRefreshed((uid) => {
        if (uid === userId) setMeals(loadMeals(userId));
      }),
    [userId]
  );

  useEffect(() => {
    const key = storageKey(userId);
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage || e.key !== key) return;
      setMeals(loadMeals(userId));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId]);

  useEffect(() => {
    saveMeals(userId, meals);
    schedulePush(userId);
  }, [userId, meals]);

  const handleAddMeal = useCallback(() => {
    setMeals((prev) => {
      const fallback = DEFAULT_NAMES[prev.length % DEFAULT_NAMES.length];
      const trimmed = newMealName.trim();
      const name = trimmed || fallback;
      return [...prev, { id: makeMealId(), name }];
    });
    setNewMealName("");
  }, [newMealName]);

  const handleUpdateName = useCallback((id: string, name: string) => {
    setMeals((prev) => prev.map((m) => (m.id === id ? { ...m, name } : m)));
  }, []);

  const handleRemoveMeal = useCallback((id: string) => {
    try {
      localStorage.removeItem(`meal_draft:${id}`);
    } catch {
      /* ignore */
    }
    setMeals((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return (
    <section className="section meals-section">
      <div className="section-header">
        <h2>ארוחות</h2>
        <p className="section-subtitle">
          צרו ארוחה חדשה למטה, ואז הוסיפו לה מצרכים ותלחצו ״הוסף ליום שלי״.
        </p>
      </div>

      <div className="meals-create-box">
        <label htmlFor="new-meal-name" className="meals-create-label">
          ארוחה חדשה
        </label>
        <div className="meals-create-row">
          <input
            id="new-meal-name"
            className="meals-create-input"
            type="text"
            value={newMealName}
            onChange={(e) => setNewMealName(e.target.value)}
            placeholder="למשל: ארוחת בוקר"
            aria-label="שם ארוחה חדשה"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddMeal();
              }
            }}
          />
          <button type="button" onClick={handleAddMeal} className="meal-add-btn">
            הוסף ארוחה
          </button>
        </div>
      </div>

      <div className="meals-existing-head">
        <h3>ארוחות קיימות</h3>
        <span>{meals.length}</span>
      </div>

      <div className="meals-list">
        {meals.length === 0 ? (
          <div className="meals-empty">עדיין לא הגדרתם ארוחה. התחילו מהתיבה למעלה.</div>
        ) : (
          meals.map((meal) => (
            <Meal
              key={meal.id}
              id={meal.id}
              name={meal.name}
              onUpdateName={(name) => handleUpdateName(meal.id, name)}
              onRemove={() => handleRemoveMeal(meal.id)}
              onAddToDaily={onAddToDaily}
              personalProducts={personalProducts}
            />
          ))
        )}
      </div>
    </section>
  );
}
