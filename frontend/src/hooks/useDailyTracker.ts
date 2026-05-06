import { useCallback, useEffect, useMemo, useState } from "react";
import { trackEvent } from "../services/analytics";
import { schedulePush, subscribeSyncRefreshed } from "../services/sync";
import { todayStr } from "../utils/date";
import { generateId } from "../utils/id";
import { coerceDailyTrackerState, HISTORY_RETENTION_DAYS } from "../utils/syncMerge";
import type { DailyEntry, DailyEntryInput, DailyTrackerState, DayLog } from "../types";

const storageKey = (uid: string) => `user_${uid}:dailyTracker:v1`;
const historyKey = (uid: string) => `user_${uid}:dailyHistory:v1`;
export { todayStr };
function journalActivationKey(uid: string): string {
  return `user_${uid}:journal_activation_sent:v1`;
}

function makeEntryId(): string {
  return generateId("de_");
}

function loadRawTracker(uid: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(uid));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
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

function writeHistory(uid: string, logs: DayLog[]): DayLog[] {
  const normalized = logs.slice(0, HISTORY_RETENTION_DAYS);
  saveHistory(uid, normalized);
  return normalized;
}

function saveHistory(uid: string, logs: DayLog[]): void {
  try {
    localStorage.setItem(historyKey(uid), JSON.stringify(logs));
  } catch {
    /* ignore */
  }
}

function archiveDay(uid: string, state: DailyTrackerState, history?: DayLog[]): DayLog[] {
  if (state.entries.length === 0) return history ?? loadHistory(uid);
  const current = history ?? loadHistory(uid);
  const without = current.filter((h) => h.date !== state.date);
  const updated = [
    { date: state.date, targetCalories: state.targetCalories, entries: state.entries },
    ...without,
  ];
  return writeHistory(uid, updated);
}

function migratePreviousDayIfNeeded(uid: string): { state: DailyTrackerState; history: DayLog[] } {
  const raw = loadRawTracker(uid);
  const state = coerceDailyTrackerState(raw);
  let history = loadHistory(uid);
  const today = todayStr();
  const rawDate =
    raw && typeof raw === "object" && typeof (raw as { date?: unknown }).date === "string"
      ? ((raw as { date: string }).date)
      : today;
  const rawEntries =
    raw && typeof raw === "object" && Array.isArray((raw as { entries?: unknown }).entries)
      ? ((raw as { entries: DailyEntry[] }).entries)
      : [];
  const rawTarget =
    raw && typeof raw === "object" && typeof (raw as { targetCalories?: unknown }).targetCalories === "number"
      ? Math.max(0, Math.floor((raw as { targetCalories: number }).targetCalories))
      : state.targetCalories;

  if (rawDate < today && rawEntries.length > 0) {
    history = archiveDay(
      uid,
      { date: rawDate, targetCalories: rawTarget, entries: rawEntries },
      history
    );
  }
  if (rawDate !== today) {
    const migrated: DailyTrackerState = {
      date: today,
      targetCalories: rawTarget,
      entries: [],
    };
    saveState(uid, migrated);
    return { state: migrated, history };
  }
  return { state, history };
}

export function computeStreak(today: DailyTrackerState, history: DayLog[]): number {
  const todayDate = today.date;
  const dayMap = new Map<string, boolean>();
  if (today.entries.length > 0) dayMap.set(todayDate, true);
  for (const log of history) {
    if (!dayMap.has(log.date)) dayMap.set(log.date, log.entries.length > 0);
  }
  let streak = 0;
  const d = new Date(todayDate);
  for (;;) {
    const ds = d.toISOString().split("T")[0];
    if (!dayMap.get(ds)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export interface UseDailyTrackerResult {
  state: DailyTrackerState;
  history: DayLog[];
  streak: number;
  setTarget: (target: number) => void;
  addEntry: (input: DailyEntryInput) => void;
  removeEntry: (id: string) => void;
  resetDay: () => void;
  /** Add a calorie entry to a past day in the history archive. */
  addHistoryEntry: (date: string, input: DailyEntryInput) => void;
  /** Remove a calorie entry from a past day in the history archive. */
  removeHistoryEntry: (date: string, entryId: string) => void;
}

export function useDailyTracker(userId: string): UseDailyTrackerResult {
  const [{ state: initState, history: initHistory }] = useState(() => migratePreviousDayIfNeeded(userId));
  const [state, setState] = useState<DailyTrackerState>(initState);
  const [history, setHistory] = useState<DayLog[]>(initHistory);

  useEffect(() => {
    const migrated = migratePreviousDayIfNeeded(userId);
    setState(migrated.state);
    setHistory(migrated.history);
  }, [userId]);

  useEffect(() => {
    return subscribeSyncRefreshed((uid) => {
      if (uid !== userId) return;
      const migrated = migratePreviousDayIfNeeded(userId);
      setState(migrated.state);
      setHistory(migrated.history);
    });
  }, [userId]);

  /** Other tabs / windows updating the same storage keys */
  useEffect(() => {
    const key = storageKey(userId);
    const histKey = historyKey(userId);
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage) return;
      if (e.key !== key && e.key !== histKey) return;
      const migrated = migratePreviousDayIfNeeded(userId);
      setState(migrated.state);
      setHistory(migrated.history);
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
        const newLogs = archiveDay(userId, prev);
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

  const addEntry = useCallback(
    (input: DailyEntryInput) => {
      const lines =
        Array.isArray(input.lines) && input.lines.length > 0 ? input.lines : undefined;
      const entry: DailyEntry = {
        id: makeEntryId(),
        name: input.name.trim() || "פריט",
        calories: Math.max(0, input.calories || 0),
        protein: Math.max(0, input.protein ?? 0),
        carbohydrates: Math.max(0, input.carbohydrates ?? 0),
        fat: Math.max(0, input.fat ?? 0),
        addedAt: Date.now(),
        ...(input.mealType ? { mealType: input.mealType } : {}),
        ...(lines ? { lines } : {}),
      };
      try {
        const actKey = journalActivationKey(userId);
        if (!localStorage.getItem(actKey)) {
          localStorage.setItem(actKey, "1");
          trackEvent("journal_activation_completed", { surface: "daily_tracker" });
        }
      } catch {
        /* ignore */
      }
      trackEvent("journal_entry_added", {
        surface: "daily_tracker",
        calories_band:
          entry.calories <= 0
            ? "zero"
            : entry.calories < 200
              ? "lt_200"
              : entry.calories < 600
                ? "lt_600"
                : "gte_600",
      });
      setState((prev) => ({ ...prev, entries: [...prev.entries, entry] }));
    },
    [userId]
  );

  const removeEntry = useCallback((id: string) => {
    setState((prev) => ({ ...prev, entries: prev.entries.filter((e) => e.id !== id) }));
  }, []);

  const resetDay = useCallback(() => {
    const newHistory = archiveDay(userId, state);
    setHistory(newHistory);
    schedulePush(userId);
    setState((prev) => ({ ...prev, entries: [] }));
  }, [userId, state]);

  const addHistoryEntry = useCallback(
    (date: string, input: DailyEntryInput) => {
      setHistory((prev) => {
        const existing = prev.find((h) => h.date === date);
        const newEntry: DailyEntry = {
          id: makeEntryId(),
          name: input.name.trim() || "פריט",
          calories: Math.max(0, input.calories || 0),
          protein: Math.max(0, input.protein ?? 0),
          carbohydrates: Math.max(0, input.carbohydrates ?? 0),
          fat: Math.max(0, input.fat ?? 0),
          addedAt: Date.now(),
          ...(input.lines ? { lines: input.lines } : {}),
        };
        let updated: DayLog[];
        if (existing) {
          updated = prev.map((h) =>
            h.date === date ? { ...h, entries: [...h.entries, newEntry] } : h
          );
        } else {
          updated = [
            { date, targetCalories: state.targetCalories, entries: [newEntry] },
            ...prev,
          ];
        }
        updated = updated.slice(0, HISTORY_RETENTION_DAYS);
        saveHistory(userId, updated);
        schedulePush(userId);
        return updated;
      });
    },
    [userId, state.targetCalories]
  );

  const removeHistoryEntry = useCallback(
    (date: string, entryId: string) => {
      setHistory((prev) => {
        const updated = prev.map((h) =>
          h.date === date ? { ...h, entries: h.entries.filter((e) => e.id !== entryId) } : h
        );
        saveHistory(userId, updated);
        schedulePush(userId);
        return updated;
      });
    },
    [userId]
  );

  const streak = useMemo(() => computeStreak(state, history), [state, history]);

  return { state, history, streak, setTarget, addEntry, removeEntry, resetDay, addHistoryEntry, removeHistoryEntry };
}
