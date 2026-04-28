/**
 * Merge local and remote sync payloads so pulls never blindly wipe devices.
 */
import type {
  DailyEntry,
  DailyTrackerState,
  DayLog,
  Meal,
  SavedRecipe,
} from "../types";
import { todayStr } from "./date";

const DEFAULT_TARGET = 2000;

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function mergeEntryLists(a: DailyEntry[], b: DailyEntry[]): DailyEntry[] {
  const map = new Map<string, DailyEntry>();
  for (const e of [...a, ...b]) {
    if (!e?.id) continue;
    const cur = map.get(e.id);
    if (!cur || (e.addedAt ?? 0) >= (cur.addedAt ?? 0)) map.set(e.id, e);
  }
  return Array.from(map.values()).sort((x, y) => x.addedAt - y.addedAt);
}

/** Interpret stored tracker blob (handles legacy/sync payloads missing `date`). */
export function coerceDailyTrackerState(raw: unknown): DailyTrackerState {
  const today = todayStr();
  if (!raw || typeof raw !== "object") {
    return { date: today, targetCalories: DEFAULT_TARGET, entries: [] };
  }
  const p = raw as Partial<DailyTrackerState>;
  const storedDate =
    typeof p.date === "string" && isIsoDate(p.date) ? p.date : today;
  const entries = Array.isArray(p.entries) ? p.entries : [];
  const entriesForToday =
    storedDate === today ? entries.filter((e) => e && typeof e.id === "string") : [];
  const target =
    typeof p.targetCalories === "number" && p.targetCalories > 0
      ? Math.floor(p.targetCalories)
      : DEFAULT_TARGET;
  return {
    date: today,
    targetCalories: target,
    entries: entriesForToday,
  };
}

/** Merge two tracker blobs from local + server for the same user. */
export function mergeDailyTrackerBlobs(localRaw: unknown, remoteRaw: unknown): DailyTrackerState {
  const today = todayStr();
  const L = coerceDailyTrackerState(localRaw);
  const R = coerceDailyTrackerState(remoteRaw);
  return {
    date: today,
    targetCalories: Math.max(L.targetCalories, R.targetCalories, DEFAULT_TARGET),
    entries: mergeEntryLists(L.entries, R.entries),
  };
}

function mergeDayLogs(a: DayLog[], b: DayLog[]): DayLog[] {
  const byDate = new Map<string, DayLog>();
  for (const log of [...a, ...b]) {
    if (!log?.date) continue;
    const prev = byDate.get(log.date);
    if (!prev) {
      byDate.set(log.date, {
        date: log.date,
        targetCalories: log.targetCalories,
        entries: [...(log.entries ?? [])],
      });
      continue;
    }
    byDate.set(log.date, {
      date: log.date,
      targetCalories: Math.max(prev.targetCalories, log.targetCalories),
      entries: mergeEntryLists(prev.entries, log.entries ?? []),
    });
  }
  return Array.from(byDate.values()).sort((x, y) => y.date.localeCompare(x.date));
}

export function mergeHistoryBlobs(localRaw: unknown, remoteRaw: unknown): DayLog[] {
  const parse = (raw: unknown): DayLog[] =>
    Array.isArray(raw) ? (raw.filter((x) => x?.date) as DayLog[]) : [];
  return mergeDayLogs(parse(localRaw), parse(remoteRaw)).slice(0, 30);
}

export function mergeRecipeBlobs(localRaw: unknown, remoteRaw: unknown): SavedRecipe[] {
  const parse = (raw: unknown): SavedRecipe[] =>
    Array.isArray(raw) ? (raw.filter((r) => r?.id) as SavedRecipe[]) : [];
  const map = new Map<string, SavedRecipe>();
  for (const r of [...parse(localRaw), ...parse(remoteRaw)]) {
    const prev = map.get(r.id);
    if (!prev || r.savedAt >= prev.savedAt) map.set(r.id, r);
  }
  return Array.from(map.values()).sort((a, b) => b.savedAt - a.savedAt);
}

function isMeal(x: unknown): x is Meal {
  return (
    x !== null &&
    typeof x === "object" &&
    typeof (x as Meal).id === "string" &&
    typeof (x as Meal).name === "string"
  );
}

function defaultMeals(): Meal[] {
  return [{ id: `m_${Math.random().toString(36).slice(2, 11)}`, name: "ארוחת בוקר" }];
}

export function mergeMealBlobs(localRaw: unknown, remoteRaw: unknown): Meal[] {
  const parse = (raw: unknown): Meal[] => {
    if (!Array.isArray(raw)) return [];
    const meals = raw.filter(isMeal);
    return meals.length > 0 ? meals : [];
  };
  const map = new Map<string, Meal>();
  for (const m of [...parse(localRaw), ...parse(remoteRaw)]) {
    map.set(m.id, m);
  }
  const merged = Array.from(map.values());
  return merged.length > 0 ? merged : defaultMeals();
}
