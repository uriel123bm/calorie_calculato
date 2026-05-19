/**
 * Cross-device user-data sync.
 *
 *   localStorage  ←→  /sync API  ←→  user_data table
 *
 * - On login/app-restore call `pullSync(uid)` once. It merges server rows into
 *   localStorage, then *always* schedules a push so any local-only data uploads.
 * - Every time a hook mutates a bucket it calls `schedulePush(uid)`.
 * - When the tab becomes visible again we pull+push to pick up other devices.
 */
import {
  extractHistoricalDayLogFromTracker,
  mergeBodyBlobs,
  mergeDailyTrackerBlobs,
  mergeHistoryBlobs,
  mergeMealBlobs,
  mergeProductBlobs,
  mergeRecipeBlobs,
  mergeWorkoutBlobs,
  mergePersonalPlanBlobs,
} from "../utils/syncMerge";
import { client } from "./api";

// Bucket keys must match the backend ALLOWED_KEYS whitelist.
export type SyncKey =
  | "tracker"
  | "history"
  | "recipes"
  | "meals"
  | "settings"
  | "products"
  | "body"
  | "workouts"
  | "water"
  | "vitamins_config"
  | "vitamins_log"
  | "personal_plan";

const TRACKER_KEY  = (uid: string) => `user_${uid}:dailyTracker:v1`;
const HISTORY_KEY  = (uid: string) => `user_${uid}:dailyHistory:v1`;
const RECIPES_KEY  = (uid: string) => `user_${uid}:savedRecipes:v1`;
const MEALS_KEY    = (uid: string) => `user_${uid}:meals:v1`;
const SETTINGS_KEY = (_uid: string) => `app:settings:v1`;
const PRODUCTS_KEY = (uid: string) => `user_${uid}:products:v1`;
const BODY_KEY     = (uid: string) => `user_${uid}:body:v1`;
const WORKOUTS_KEY = (uid: string) => `user_${uid}:workouts_sync:v1`;
const WATER_KEY          = (uid: string) => `user_${uid}:water:v1`;
const VITAMINS_CONFIG_KEY = (uid: string) => `user_${uid}:vitamins_config:v1`;
const VITAMINS_LOG_KEY    = (uid: string) => `user_${uid}:vitamins_log:v1`;
const PERSONAL_PLAN_KEY   = (uid: string) => `user_${uid}:personal_plan:v1`;

function localKey(uid: string, key: SyncKey): string {
  switch (key) {
    case "tracker":  return TRACKER_KEY(uid);
    case "history":  return HISTORY_KEY(uid);
    case "recipes":  return RECIPES_KEY(uid);
    case "meals":    return MEALS_KEY(uid);
    case "settings": return SETTINGS_KEY(uid);
    case "products": return PRODUCTS_KEY(uid);
    case "body":     return BODY_KEY(uid);
    case "workouts": return WORKOUTS_KEY(uid);
    case "water":           return WATER_KEY(uid);
    case "vitamins_config": return VITAMINS_CONFIG_KEY(uid);
    case "vitamins_log":    return VITAMINS_LOG_KEY(uid);
    case "personal_plan":   return PERSONAL_PLAN_KEY(uid);
  }
}

function readLocal(uid: string, key: SyncKey): unknown | null {
  try {
    const raw = localStorage.getItem(localKey(uid, key));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocal(uid: string, key: SyncKey, value: unknown): void {
  try {
    localStorage.setItem(localKey(uid, key), JSON.stringify(value));
  } catch { /* ignore quota errors */ }
}

// ── Pub/sub so hooks can re-read localStorage after a pull ──
type Listener = (uid: string) => void;
const _listeners = new Set<Listener>();

export function subscribeSyncRefreshed(cb: Listener): () => void {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

function notifyRefreshed(uid: string): void {
  _listeners.forEach((cb) => {
    try { cb(uid); } catch { /* ignore listener errors */ }
  });
}

// ── Pull (server → local) ──────────────────────────────────
interface SyncResponse {
  tracker:         unknown | null;
  history:         unknown | null;
  recipes:         unknown | null;
  meals:           unknown | null;
  settings:        unknown | null;
  products:        unknown | null;
  body:            unknown | null;
  workouts:        unknown | null;
  water:           unknown | null;
  vitamins_config: unknown | null;
  vitamins_log:    unknown | null;
  personal_plan:   unknown | null;
  updated_at:      string | null;
}

const _pullInFlightByUid = new Map<string, Promise<void>>();
let _activeUid: string | null = null;

/** Call when the logged-in user changes (login / logout). */
export function setSyncUserId(uid: string | null): void {
  _activeUid = uid;
}

export function pullSync(uid: string): Promise<void> {
  const inFlight = _pullInFlightByUid.get(uid);
  if (inFlight) return inFlight;
  const task = (async () => {
    try {
      const { data } = await client.get<SyncResponse>("/sync");
      const localTrackerRaw = readLocal(uid, "tracker");
      const remoteTrackerRaw = data.tracker;
      const localCarryLog = extractHistoricalDayLogFromTracker(localTrackerRaw);
      const remoteCarryLog = extractHistoricalDayLogFromTracker(remoteTrackerRaw);

      const mergedTracker = mergeDailyTrackerBlobs(localTrackerRaw, remoteTrackerRaw);
      writeLocal(uid, "tracker", mergedTracker);

      const historyWithCarry = [
        ...(Array.isArray(readLocal(uid, "history")) ? (readLocal(uid, "history") as unknown[]) : []),
        ...(Array.isArray(data.history) ? data.history : []),
        ...(localCarryLog ? [localCarryLog] : []),
        ...(remoteCarryLog ? [remoteCarryLog] : []),
      ];
      const mergedHistory = mergeHistoryBlobs(historyWithCarry, []);
      writeLocal(uid, "history", mergedHistory);

      const mergedRecipes = mergeRecipeBlobs(readLocal(uid, "recipes"), data.recipes);
      writeLocal(uid, "recipes", mergedRecipes);

      const mergedMeals = mergeMealBlobs(readLocal(uid, "meals"), data.meals);
      writeLocal(uid, "meals", mergedMeals);

      const mergedProducts = mergeProductBlobs(readLocal(uid, "products"), data.products);
      writeLocal(uid, "products", mergedProducts);

      if (data.settings && typeof data.settings === "object") {
        writeLocal(uid, "settings", data.settings);
      }

      const mergedBody = mergeBodyBlobs(readLocal(uid, "body"), data.body);
      if (mergedBody) writeLocal(uid, "body", mergedBody);
      const mergedWorkouts = mergeWorkoutBlobs(readLocal(uid, "workouts"), data.workouts);
      writeLocal(uid, "workouts", mergedWorkouts);

      if (data.water)           writeLocal(uid, "water",           data.water);
      if (data.vitamins_config) writeLocal(uid, "vitamins_config", data.vitamins_config);
      if (data.vitamins_log)    writeLocal(uid, "vitamins_log",    data.vitamins_log);

      const mergedPlan = mergePersonalPlanBlobs(
        readLocal(uid, "personal_plan"),
        data.personal_plan
      );
      if (mergedPlan) writeLocal(uid, "personal_plan", mergedPlan);

      notifyRefreshed(uid);
      schedulePush(uid);
    } catch {
      // 401, network — keep working offline; next visibility or edit retries.
    } finally {
      _pullInFlightByUid.delete(uid);
    }
  })();
  _pullInFlightByUid.set(uid, task);
  return task;
}

// ── Push (local → server) ──────────────────────────────────
function readAllBuckets(uid: string): Record<SyncKey, unknown | null> {
  return {
    tracker:  readLocal(uid, "tracker"),
    history:  readLocal(uid, "history"),
    recipes:  readLocal(uid, "recipes"),
    meals:    readLocal(uid, "meals"),
    settings: readLocal(uid, "settings"),
    products: readLocal(uid, "products"),
    body:     readLocal(uid, "body"),
    workouts: readLocal(uid, "workouts"),
    water:           readLocal(uid, "water"),
    vitamins_config: readLocal(uid, "vitamins_config"),
    vitamins_log:    readLocal(uid, "vitamins_log"),
    personal_plan:   readLocal(uid, "personal_plan"),
  };
}

export async function pushSyncNow(uid: string): Promise<void> {
  const buckets = readAllBuckets(uid);
  const empty =
    !buckets.tracker &&
    !buckets.history &&
    !buckets.recipes &&
    !buckets.meals &&
    !buckets.settings &&
    !buckets.products &&
    !buckets.body &&
    !buckets.workouts &&
    !buckets.personal_plan;
  if (empty) return;
  try {
    await client.put("/sync", buckets);
  } catch {
    // Retried on next change / visibility.
  }
}

const PUSH_DEBOUNCE_MS = 1500;
const _pushTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function schedulePush(uid: string): void {
  const existing = _pushTimers.get(uid);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    _pushTimers.delete(uid);
    void pushSyncNow(uid);
  }, PUSH_DEBOUNCE_MS);
  _pushTimers.set(uid, timer);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    _pushTimers.forEach((timer, uid) => {
      clearTimeout(timer);
      void pushSyncNow(uid);
    });
    _pushTimers.clear();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    const uid = _activeUid;
    if (!uid) return;
    void pullSync(uid);
  });

  window.addEventListener("online", () => {
    const uid = _activeUid;
    if (uid) void pullSync(uid);
  });
}

