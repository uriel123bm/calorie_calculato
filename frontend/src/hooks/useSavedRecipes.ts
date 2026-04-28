import { useCallback, useEffect, useState } from "react";
import { schedulePush, subscribeSyncRefreshed } from "../services/sync";
import type { NutritionPer100g, SavedRecipe } from "../types";

const storageKey = (uid: string) => `user_${uid}:savedRecipes:v1`;

function load(uid: string): SavedRecipe[] {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    return raw ? (JSON.parse(raw) as SavedRecipe[]) : [];
  } catch { return []; }
}

function save(uid: string, recipes: SavedRecipe[]): void {
  try { localStorage.setItem(storageKey(uid), JSON.stringify(recipes)); } catch { /* ignore */ }
}

/** Result of a save attempt */
export type SaveResult = "saved" | "duplicate";

export interface UseSavedRecipesResult {
  recipes: SavedRecipe[];
  saveRecipe: (
    name: string,
    totalWeightG: number,
    per100g: NutritionPer100g,
    servings?: number
  ) => SaveResult;
  deleteRecipe: (id: string) => void;
}

export function useSavedRecipes(userId: string): UseSavedRecipesResult {
  const [recipes, setRecipes] = useState<SavedRecipe[]>(() => load(userId));

  // Re-load when user changes (login / logout)
  useEffect(() => { setRecipes(load(userId)); }, [userId]);

  // Reload from localStorage whenever the sync layer pulls fresh data.
  useEffect(() => {
    return subscribeSyncRefreshed((uid) => {
      if (uid !== userId) return;
      setRecipes(load(userId));
    });
  }, [userId]);

  useEffect(() => {
    const key = storageKey(userId);
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage || e.key !== key) return;
      setRecipes(load(userId));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId]);

  const saveRecipe = useCallback(
    (name: string, totalWeightG: number, per100g: NutritionPer100g, servings?: number): SaveResult => {
      const trimmed = name.trim() || "מתכון ללא שם";
      const normalised = trimmed.toLowerCase();

      const current = load(userId);
      if (current.some((r) => r.name.toLowerCase() === normalised)) return "duplicate";

      const entry: SavedRecipe = {
        id: Math.random().toString(36).slice(2, 11),
        name: trimmed,
        savedAt: Date.now(),
        totalWeightG,
        per100g,
        servings,
      };
      const updated = [entry, ...current];
      save(userId, updated);
      setRecipes(updated);
      schedulePush(userId);
      return "saved";
    },
    [userId]
  );

  const deleteRecipe = useCallback((id: string) => {
    setRecipes((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      save(userId, updated);
      schedulePush(userId);
      return updated;
    });
  }, [userId]);

  return { recipes, saveRecipe, deleteRecipe };
}
