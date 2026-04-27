import { useCallback, useEffect, useState } from "react";
import type { DailyEntry, DailyEntryInput, DailyTrackerState, DayLog } from "../types";

const storageKey  = (uid: string) => `user_${uid}:dailyTracker:v1`;
const historyKey  = (uid: string) => `user_${uid}:dailyHistory:v1`;
const DEFAULT_TARGET = 2000;
const MAX_HISTORY_DAYS = 30;

export function todayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function makeEntryId(): string {
  return Math.random().toString(36).slice(2, 11);
}

function loadState(uid: string): DailyTrackerState {
  if (typeof window === "undefined") {
    return { date: todayStr(), targetCalories: DEFAULT_TARGET, entries: [] };
  }
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return { date: todayStr(), targetCalories: DEFAULT_TARGET, entries: [] };
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

function saveState(uid: string, state: DailyTrackerState): void {
  try { localStorage.setItem(storageKey(uid), JSON.stringify(state)); } catch { /* ignore */ }
}

function loadHistory(uid: string): DayLog[] {
  try {
    const raw = localStorage.getItem(historyKey(uid));
    return raw ? (JSON.parse(raw) as DayLog[]) : [];
  } catch { return []; }
}

function saveHistory(uid: string, logs: DayLog[]): void {
  try { localStorage.setItem(historyKey(uid), JSON.stringify(logs)); } catch { /* ignore */ }
}

function archiveDay(uid: string, state: DailyTrackerState): void {
  if (state.entries.length === 0) return;
  const history = loadHistory(uid);
  const without = history.filter((h) => h.date !== state.date);
  const updated = [
    { date: state.date, targetCalories: state.targetCalories, entries: state.entries },
    ...without,
  ].slice(0, MAX_HISTORY_DAYS);
  saveHistory(uid, updated);
}

export interface UseDailyTrackerResult {
  state: DailyTrackerState;
  history: DayLog[];
  setTarget: (target: number) => void;
  addEntry: (input: DailyEntryInput) => void;
  removeEntry: (id: string) => void;
  resetDay: () => void;
}

export function useDailyTracker(userId: string): UseDailyTrackerResult {
  const [state, setState] = useState<DailyTrackerState>(() => loadState(userId));
  const [history, setHistory] = useState<DayLog[]>(() => loadHistory(userId));

  // Re-load when the user changes (login / logout)
  useEffect(() => {
    setState(loadState(userId));
    setHistory(loadHistory(userId));
  }, [userId]);

  useEffect(() => { saveState(userId, state); }, [userId, state]);

  // Auto-reset at midnight: archive yesterday → fresh today
  useEffect(() => {
    const interval = setInterval(() => {
      const today = todayStr();
      setState((prev) => {
        if (prev.date === today) return prev;
        archiveDay(userId, prev);
        const newLogs = loadHistory(userId);
        setHistory(newLogs);
        return { date: today, targetCalories: prev.targetCalories, entries: [] };
      });
    }, 60_000);
    return () => clearInterval(interval);
  }, [userId]);

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
    setState((prev) => ({ ...prev, entries: prev.entries.filter((e) => e.id !== id) }));
  }, []);

  const resetDay = useCallback(() => {
    setState((prev) => {
      archiveDay(userId, prev);
      setHistory(loadHistory(userId));
      return { ...prev, entries: [] };
    });
  }, [userId]);

  return { state, history, setTarget, addEntry, removeEntry, resetDay };
}
