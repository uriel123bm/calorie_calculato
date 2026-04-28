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
  mergeDailyTrackerBlobs,
  mergeHistoryBlobs,
  mergeMealBlobs,
  mergeRecipeBlobs,
} from "../utils/syncMerge";
import { client } from "./api";

// Bucket keys must match the backend ALLOWED_KEYS whitelist.
export type SyncKey = "tracker" | "history" | "recipes" | "meals";

const TRACKER_KEY = (uid: string) => `user_${uid}:dailyTracker:v1`;
const HISTORY_KEY = (uid: string) => `user_${uid}:dailyHistory:v1`;
const RECIPES_KEY = (uid: string) => `user_${uid}:savedRecipes:v1`;
const MEALS_KEY   = (uid: string) => `user_${uid}:meals:v1`;

function localKey(uid: string, key: SyncKey): string {
  switch (key) {
    case "tracker": return TRACKER_KEY(uid);
    case "history": return HISTORY_KEY(uid);
    case "recipes": return RECIPES_KEY(uid);
    case "meals":   return MEALS_KEY(uid);
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
  tracker:  unknown | null;
  history:  unknown | null;
  recipes:  unknown | null;
  meals:    unknown | null;
  settings: unknown | null;
  updated_at: string | null;
}

let _pullInFlight: Promise<void> | null = null;
let _activeUid: string | null = null;

/** Call when the logged-in user changes (login / logout). */
export function setSyncUserId(uid: string | null): void {
  _activeUid = uid;
}

export function pullSync(uid: string): Promise<void> {
  if (_pullInFlight) return _pullInFlight;
  _pullInFlight = (async () => {
    try {
      const { data } = await client.get<SyncResponse>("/sync");

      const mergedTracker = mergeDailyTrackerBlobs(readLocal(uid, "tracker"), data.tracker);
      writeLocal(uid, "tracker", mergedTracker);

      const mergedHistory = mergeHistoryBlobs(readLocal(uid, "history"), data.history);
      writeLocal(uid, "history", mergedHistory);

      const mergedRecipes = mergeRecipeBlobs(readLocal(uid, "recipes"), data.recipes);
      writeLocal(uid, "recipes", mergedRecipes);

      const mergedMeals = mergeMealBlobs(readLocal(uid, "meals"), data.meals);
      writeLocal(uid, "meals", mergedMeals);

      notifyRefreshed(uid);
      schedulePush(uid);
    } catch {
      // 401, network — keep working offline; next visibility or edit retries.
    } finally {
      _pullInFlight = null;
    }
  })();
  return _pullInFlight;
}

// ── Push (local → server) ──────────────────────────────────
function readAllBuckets(uid: string): Record<SyncKey, unknown | null> {
  return {
    tracker: readLocal(uid, "tracker"),
    history: readLocal(uid, "history"),
    recipes: readLocal(uid, "recipes"),
    meals:   readLocal(uid, "meals"),
  };
}

export async function pushSyncNow(uid: string): Promise<void> {
  const buckets = readAllBuckets(uid);
  if (!buckets.tracker && !buckets.history && !buckets.recipes && !buckets.meals) return;
  try {
    await client.put("/sync", buckets);
  } catch {
    // Retried on next change / visibility.
  }
}

const PUSH_DEBOUNCE_MS = 1500;
let _pushTimer: ReturnType<typeof setTimeout> | null = null;
let _pushUid: string | null = null;

export function schedulePush(uid: string): void {
  _pushUid = uid;
  if (_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => {
    _pushTimer = null;
    if (_pushUid) void pushSyncNow(_pushUid);
  }, PUSH_DEBOUNCE_MS);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (_pushTimer && _pushUid) {
      clearTimeout(_pushTimer);
      _pushTimer = null;
      void pushSyncNow(_pushUid);
    }
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
