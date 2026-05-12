import { useCallback, useEffect, useState } from "react";
import { schedulePush, subscribeSyncRefreshed } from "../services/sync";
import { todayStr } from "./useDailyTracker";
import type { VitaminConfig, VitaminLog } from "../types";

const configKey  = (uid: string) => `user_${uid}:vitamins_config:v1`;
const logKey     = (uid: string) => `user_${uid}:vitamins_log:v1`;
const MAX_LOG_DAYS = 30;

// ── persistence helpers ───────────────────────────────────────────────────────

function loadConfig(uid: string): VitaminConfig[] {
  try {
    const raw = localStorage.getItem(configKey(uid));
    return raw ? (JSON.parse(raw) as VitaminConfig[]) : [];
  } catch { return []; }
}

function saveConfig(uid: string, list: VitaminConfig[]): void {
  try { localStorage.setItem(configKey(uid), JSON.stringify(list)); } catch { /* ignore */ }
}

function loadLogs(uid: string): VitaminLog[] {
  try {
    const raw = localStorage.getItem(logKey(uid));
    return raw ? (JSON.parse(raw) as VitaminLog[]) : [];
  } catch { return []; }
}

function saveLogs(uid: string, logs: VitaminLog[]): void {
  try { localStorage.setItem(logKey(uid), JSON.stringify(logs)); } catch { /* ignore */ }
}

// ── hook ─────────────────────────────────────────────────────────────────────

export interface UseVitaminsResult {
  vitamins: VitaminConfig[];
  logs: VitaminLog[];
  /** Whether every configured vitamin has been taken today. */
  allTakenToday: boolean;
  addVitamin: (name: string, dose?: string) => void;
  removeVitamin: (id: string) => void;
  toggleTaken: (vitaminId: string, date?: string) => void;
  isTaken: (vitaminId: string, date?: string) => boolean;
  /** Last N days in ascending order for weekly grid. */
  lastNDays: (n: number) => string[];
}

export function useVitamins(userId: string): UseVitaminsResult {
  const [vitamins, setVitamins] = useState<VitaminConfig[]>(() => loadConfig(userId));
  const [logs, setLogs]         = useState<VitaminLog[]>(() => loadLogs(userId));

  // Reload when userId changes (e.g. switching accounts).
  useEffect(() => {
    setVitamins(loadConfig(userId));
    setLogs(loadLogs(userId));
  }, [userId]);

  // Keep in sync with other tabs.
  useEffect(() => {
    const ck = configKey(userId);
    const lk = logKey(userId);
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage) return;
      if (e.key === ck) setVitamins(loadConfig(userId));
      if (e.key === lk) setLogs(loadLogs(userId));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId]);

  // Refresh after cross-device sync pull.
  useEffect(() => {
    return subscribeSyncRefreshed((uid) => {
      if (uid !== userId) return;
      setVitamins(loadConfig(userId));
      setLogs(loadLogs(userId));
    });
  }, [userId]);

  // Persist config changes.
  useEffect(() => {
    saveConfig(userId, vitamins);
    schedulePush(userId);
  }, [userId, vitamins]);

  // Persist log changes.
  useEffect(() => {
    saveLogs(userId, logs);
    schedulePush(userId);
  }, [userId, logs]);

  // ── helpers ─────────────────────────────────────────────────────────────────

  const getLogForDate = useCallback(
    (date: string): VitaminLog | undefined => logs.find((l) => l.date === date),
    [logs]
  );

  const isTaken = useCallback(
    (vitaminId: string, date?: string): boolean => {
      const d = date ?? todayStr();
      return getLogForDate(d)?.taken.includes(vitaminId) ?? false;
    },
    [getLogForDate]
  );

  const allTakenToday = vitamins.length > 0 &&
    vitamins.every((v) => isTaken(v.id));

  const lastNDays = useCallback((n: number): string[] => {
    const today = new Date();
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (n - 1 - i));
      return d.toISOString().slice(0, 10);
    });
  }, []);

  // ── mutations ────────────────────────────────────────────────────────────────

  const addVitamin = useCallback((name: string, dose?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setVitamins((prev) => [
      ...prev,
      { id: Math.random().toString(36).slice(2, 10), name: trimmed, dose: dose?.trim() || undefined },
    ]);
  }, []);

  const removeVitamin = useCallback((id: string) => {
    setVitamins((prev) => prev.filter((v) => v.id !== id));
    // Also scrub the id from all logs.
    setLogs((prev) =>
      prev.map((l) => ({ ...l, taken: l.taken.filter((t) => t !== id) }))
    );
  }, []);

  const toggleTaken = useCallback((vitaminId: string, date?: string) => {
    const d = date ?? todayStr();
    setLogs((prev) => {
      const existing = prev.find((l) => l.date === d);
      let updated: VitaminLog[];
      if (!existing) {
        updated = [...prev, { date: d, taken: [vitaminId] }];
      } else {
        const alreadyTaken = existing.taken.includes(vitaminId);
        updated = prev.map((l) =>
          l.date !== d ? l : {
            ...l,
            taken: alreadyTaken
              ? l.taken.filter((t) => t !== vitaminId)
              : [...l.taken, vitaminId],
          }
        );
      }
      // Trim to last MAX_LOG_DAYS.
      updated.sort((a, b) => a.date.localeCompare(b.date));
      return updated.slice(-MAX_LOG_DAYS);
    });
  }, []);

  return { vitamins, logs, allTakenToday, addVitamin, removeVitamin, toggleTaken, isTaken, lastNDays };
}
