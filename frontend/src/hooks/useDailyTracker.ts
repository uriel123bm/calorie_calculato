import { useCallback, useEffect, useState } from "react";
import { schedulePush, subscribeSyncRefreshed } from "../services/sync";
import { todayStr } from "../utils/date";
import { coerceDailyTrackerState } from "../utils/syncMerge";
import type { DailyEntry, DailyEntryInput, DailyTrackerState, DayLog } from "../types";

const storageKey = (uid: string) => `user_${uid}:dailyTracker:v1`;
const historyKey = (uid: string) => `user_${uid}:dailyHistory:v1`;
export { todayStr };
const MAX_HISTORY_DAYS = 30;

function makeEntryId(): string {
  return Math.random().toString(36).slice(2, 11);
}

function loadState(uid: string): DailyTrackerState {
  if (typeof window === "undefined") {
    return coerceDailyTrackerState(null);
  }
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return coerceDailyTrackerState(null);
    return coerceDailyTrackerState(JSON.parse(raw));
  } catch {
    return coerceDailyTrackerState(null);
  }
}

function saveState(uid: string, state: DailyTrackerState): void {
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function loadHistory(uid: string): DayLog[] {
  try {
    const raw = localStorage.getItem(historyKey(uid));
    return raw ? (JSON.parse(raw) as DayLog[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(uid: string, logs: DayLog[]): void {
  try {
    localStorage.setItem(historyKey(uid), JSON.stringify(logs));
  } catch {
    /* ignore */
  }
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

  useEffect(() => {
    setState(loadState(userId));
    setHistory(loadHistory(userId));
  }, [userId]);

  useEffect(() => {
    return subscribeSyncRefreshed((uid) => {
      if (uid !== userId) return;
      setState(loadState(userId));
      setHistory(loadHistory(userId));
    });
  }, [userId]);

  /** Other tabs / windows updating the same storage keys */
  useEffect(() => {
    const key = storageKey(userId);
    const histKey = historyKey(userId);
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage) return;
      if (e.key !== key && e.key !== histKey) return;
      setState(loadState(userId));
      setHistory(loadHistory(userId));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId]);

  useEffect(() => {
    saveState(userId, state);
    schedulePush(userId);
  }, [userId, state]);

  useEffect(() => {
    const interval = setInterval(() => {
      const today = todayStr();
      setState((prev) => {
        if (prev.date === today) return prev;
        archiveDay(userId, prev);
        const newLogs = loadHistory(userId);
        setHistory(newLogs);
        schedulePush(userId);
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
      schedulePush(userId);
      return { ...prev, entries: [] };
    });
  }, [userId]);

  return { state, history, setTarget, addEntry, removeEntry, resetDay };
}
