import { useCallback, useEffect, useState } from "react";
import type { DailyEntry, DailyEntryInput, DailyTrackerState } from "../types";

const STORAGE_KEY = "dailyTracker:v1";
const DEFAULT_TARGET = 2000;

function todayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function makeEntryId(): string {
  return Math.random().toString(36).slice(2, 11);
}

function loadState(): DailyTrackerState {
  if (typeof window === "undefined") {
    return { date: todayStr(), targetCalories: DEFAULT_TARGET, entries: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { date: todayStr(), targetCalories: DEFAULT_TARGET, entries: [] };
    }
    const parsed = JSON.parse(raw) as Partial<DailyTrackerState>;
    const today = todayStr();
    return {
      date: today,
      targetCalories:
        typeof parsed.targetCalories === "number" && parsed.targetCalories > 0
          ? parsed.targetCalories
          : DEFAULT_TARGET,
      entries:
        parsed.date === today && Array.isArray(parsed.entries)
          ? parsed.entries
          : [],
    };
  } catch {
    return { date: todayStr(), targetCalories: DEFAULT_TARGET, entries: [] };
  }
}

function saveState(state: DailyTrackerState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures (private mode, full quota).
  }
}

export interface UseDailyTrackerResult {
  state: DailyTrackerState;
  setTarget: (target: number) => void;
  addEntry: (input: DailyEntryInput) => void;
  removeEntry: (id: string) => void;
  resetDay: () => void;
}

export function useDailyTracker(): UseDailyTrackerResult {
  const [state, setState] = useState<DailyTrackerState>(() => loadState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  // Auto-reset when the date rolls over while the page stays open.
  useEffect(() => {
    const interval = setInterval(() => {
      const today = todayStr();
      setState((prev) =>
        prev.date === today ? prev : { ...prev, date: today, entries: [] }
      );
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const setTarget = useCallback((target: number) => {
    if (Number.isNaN(target) || target < 0) return;
    setState((prev) => ({ ...prev, targetCalories: Math.floor(target) }));
  }, []);

  const addEntry = useCallback((input: DailyEntryInput) => {
    const entry: DailyEntry = {
      id: makeEntryId(),
      name: input.name.trim() || "פריט",
      calories: Math.max(0, input.calories || 0),
      protein: Math.max(0, input.protein ?? 0),
      carbohydrates: Math.max(0, input.carbohydrates ?? 0),
      fat: Math.max(0, input.fat ?? 0),
      addedAt: Date.now(),
    };
    setState((prev) => ({ ...prev, entries: [...prev.entries, entry] }));
  }, []);

  const removeEntry = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      entries: prev.entries.filter((e) => e.id !== id),
    }));
  }, []);

  const resetDay = useCallback(() => {
    setState((prev) => ({ ...prev, entries: [] }));
  }, []);

  return { state, setTarget, addEntry, removeEntry, resetDay };
}
