/**
 * Merge local and remote sync payloads so pulls never blindly wipe devices.
 */
import type {
  BodyMetrics,
  DailyEntry,
  DailyTrackerState,
  DayLog,
  Meal,
  SavedRecipe,
  UserProduct,
  WeightLogEntry,
} from "../types";
import { todayStr } from "./date";
import { generateId } from "./id";

const DEFAULT_TARGET = 2000;
export const HISTORY_RETENTION_DAYS = 3650;
export const MAX_HISTORY_DAYS = HISTORY_RETENTION_DAYS;

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
  const mergedTarget =
    L.targetCalories !== DEFAULT_TARGET
      ? L.targetCalories
      : R.targetCalories !== DEFAULT_TARGET
        ? R.targetCalories
        : DEFAULT_TARGET;
  return {
    date: today,
    targetCalories: mergedTarget,
    entries: mergeEntryLists(L.entries, R.entries),
  };
}

export function extractHistoricalDayLogFromTracker(raw: unknown): DayLog | null {
  const today = todayStr();
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Partial<DailyTrackerState>;
  if (typeof payload.date !== "string" || payload.date >= today) return null;
  if (!Array.isArray(payload.entries) || payload.entries.length === 0) return null;
  const target =
    typeof payload.targetCalories === "number" && payload.targetCalories > 0
      ? Math.floor(payload.targetCalories)
      : DEFAULT_TARGET;
  return {
    date: payload.date,
    targetCalories: target,
    entries: payload.entries.filter((e) => e && typeof e.id === "string"),
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
  return mergeDayLogs(parse(localRaw), parse(remoteRaw)).slice(0, HISTORY_RETENTION_DAYS);
}

type WorkoutSyncBlob = {
  targetSessions?: number;
  lastPromptWeek?: string | null;
  weeklyFeatureSeen?: boolean;
  plannedDays?: string[];
  entries?: Array<{
    id: string;
    type: string;
    durationMin: number;
    date: string;
    addedAt: number;
  }>;
};

export function mergeWorkoutBlobs(localRaw: unknown, remoteRaw: unknown): WorkoutSyncBlob {
  const parse = (raw: unknown): WorkoutSyncBlob => {
    if (!raw || typeof raw !== "object") return {};
    return raw as WorkoutSyncBlob;
  };
  const L = parse(localRaw);
  const R = parse(remoteRaw);
  const map = new Map<string, NonNullable<WorkoutSyncBlob["entries"]>[number]>();
  for (const e of [...(L.entries ?? []), ...(R.entries ?? [])]) {
    if (!e?.id || !e?.date) continue;
    const cur = map.get(e.id);
    if (!cur || (e.addedAt ?? 0) >= (cur.addedAt ?? 0)) map.set(e.id, e);
  }
  return {
    targetSessions: Math.max(1, Math.floor((R.targetSessions ?? L.targetSessions ?? 3))),
    lastPromptWeek: R.lastPromptWeek ?? L.lastPromptWeek ?? null,
    weeklyFeatureSeen: Boolean(R.weeklyFeatureSeen ?? L.weeklyFeatureSeen),
    plannedDays: Array.isArray(R.plannedDays) ? R.plannedDays : Array.isArray(L.plannedDays) ? L.plannedDays : [],
    entries: Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)),
  };
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
  return [{ id: generateId("meal_"), name: "ארוחת בוקר" }];
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

// ── Personal products library ──────────────────────────────
function isUserProduct(x: unknown): x is UserProduct {
  if (!x || typeof x !== "object") return false;
  const p = x as Partial<UserProduct>;
  return (
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    typeof p.servingValue === "number" &&
    typeof p.calories === "number"
  );
}

export function mergeProductBlobs(localRaw: unknown, remoteRaw: unknown): UserProduct[] {
  const parse = (raw: unknown): UserProduct[] =>
    Array.isArray(raw) ? raw.filter(isUserProduct) : [];
  const map = new Map<string, UserProduct>();
  for (const p of [...parse(localRaw), ...parse(remoteRaw)]) {
    const prev = map.get(p.id);
    if (!prev || p.addedAt >= prev.addedAt) map.set(p.id, p);
  }
  return Array.from(map.values()).sort((a, b) => b.addedAt - a.addedAt);
}

// ── Body metrics + weight log ──────────────────────────────
function isWeightLogEntry(x: unknown): x is WeightLogEntry {
  if (!x || typeof x !== "object") return false;
  const e = x as Partial<WeightLogEntry>;
  return (
    typeof e.date === "string" &&
    isIsoDate(e.date) &&
    typeof e.weightKg === "number" &&
    Number.isFinite(e.weightKg) &&
    e.weightKg > 0
  );
}

function isBodyMetrics(x: unknown): x is BodyMetrics {
  if (!x || typeof x !== "object") return false;
  const m = x as Partial<BodyMetrics>;
  return (
    typeof m.heightCm === "number" &&
    typeof m.startWeightKg === "number" &&
    typeof m.currentWeightKg === "number" &&
    Array.isArray(m.log)
  );
}

/** Merge log entries by date — latest weight per date wins. */
function mergeWeightLog(a: WeightLogEntry[], b: WeightLogEntry[]): WeightLogEntry[] {
  const map = new Map<string, WeightLogEntry>();
  for (const e of [...a, ...b]) {
    if (!isWeightLogEntry(e)) continue;
    map.set(e.date, e);
  }
  return Array.from(map.values()).sort((x, y) => x.date.localeCompare(y.date));
}

/**
 * Body metrics is a single object (not a list). When merging, prefer
 * the side with the more recent `updatedAt`, but always merge the
 * weight logs together so no measurements are lost.
 */
export function mergeBodyBlobs(localRaw: unknown, remoteRaw: unknown): BodyMetrics | null {
  const L = isBodyMetrics(localRaw) ? localRaw : null;
  const R = isBodyMetrics(remoteRaw) ? remoteRaw : null;
  if (!L && !R) return null;
  if (L && !R) return { ...L, log: mergeWeightLog(L.log, []) };
  if (!L && R) return { ...R, log: mergeWeightLog([], R.log) };

  const Lnn = L as BodyMetrics;
  const Rnn = R as BodyMetrics;
  const winner = (Lnn.updatedAt ?? 0) >= (Rnn.updatedAt ?? 0) ? Lnn : Rnn;
  const mergedLog = mergeWeightLog(Lnn.log, Rnn.log);
  const last = mergedLog.length > 0 ? mergedLog[mergedLog.length - 1] : null;
  return {
    ...winner,
    log: mergedLog,
    currentWeightKg: last ? last.weightKg : winner.currentWeightKg,
  };
}
