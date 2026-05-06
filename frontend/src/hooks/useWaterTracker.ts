import { useCallback, useEffect, useState } from "react";
import { schedulePush, subscribeSyncRefreshed } from "../services/sync";
import { todayStr } from "../utils/date";

export interface WaterEntry {
  addedAt: number;
  amountMl: number;
}

export interface WaterState {
  date: string;
  entries: WaterEntry[];
  goalMl: number;
}

export const CUP_ML = 180; // כוס = 180 מ"ל
const DEFAULT_GOAL_ML = 3000; // 3 ליטר
const storageKey = (uid: string) => `user_${uid}:water:v1`;

function loadWater(uid: string): WaterState {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return { date: todayStr(), entries: [], goalMl: DEFAULT_GOAL_ML };
    const parsed = JSON.parse(raw) as Partial<WaterState>;
    const date = typeof parsed.date === "string" ? parsed.date : todayStr();
    const today = todayStr();
    if (date !== today) {
      return { date: today, entries: [], goalMl: parsed.goalMl ?? DEFAULT_GOAL_ML };
    }
    return {
      date: today,
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      goalMl: typeof parsed.goalMl === "number" && parsed.goalMl > 0 ? parsed.goalMl : DEFAULT_GOAL_ML,
    };
  } catch {
    return { date: todayStr(), entries: [], goalMl: DEFAULT_GOAL_ML };
  }
}

function saveWater(uid: string, state: WaterState): void {
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(state));
  } catch { /* ignore */ }
}

export interface UseWaterTrackerResult {
  state: WaterState;
  totalMl: number;
  pct: number;
  addWater: (amountMl: number) => void;
  removeLastEntry: () => void;
  setGoal: (goalMl: number) => void;
}

export function useWaterTracker(userId: string): UseWaterTrackerResult {
  const [state, setState] = useState<WaterState>(() => loadWater(userId));

  useEffect(() => {
    setState(loadWater(userId));
  }, [userId]);

  useEffect(() => {
    return subscribeSyncRefreshed((uid) => {
      if (uid !== userId) return;
      setState(loadWater(userId));
    });
  }, [userId]);

  // Reset on new day
  useEffect(() => {
    const interval = setInterval(() => {
      const today = todayStr();
      setState((prev) => {
        if (prev.date === today) return prev;
        return { date: today, entries: [], goalMl: prev.goalMl };
      });
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    saveWater(userId, state);
    schedulePush(userId);
  }, [userId, state]);

  const addWater = useCallback((amountMl: number) => {
    if (amountMl <= 0) return;
    setState((prev) => ({
      ...prev,
      entries: [...prev.entries, { addedAt: Date.now(), amountMl }],
    }));
  }, []);

  const removeLastEntry = useCallback(() => {
    setState((prev) => ({
      ...prev,
      entries: prev.entries.slice(0, -1),
    }));
  }, []);

  const setGoal = useCallback((goalMl: number) => {
    if (goalMl <= 0) return;
    setState((prev) => ({ ...prev, goalMl }));
  }, []);

  const totalMl = state.entries.reduce((s, e) => s + e.amountMl, 0);
  const pct = Math.min(100, state.goalMl > 0 ? (totalMl / state.goalMl) * 100 : 0);

  return { state, totalMl, pct, addWater, removeLastEntry, setGoal };
}
