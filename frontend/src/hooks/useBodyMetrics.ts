import { useCallback, useEffect, useState } from "react";
import { schedulePush, subscribeSyncRefreshed } from "../services/sync";
import type { BodyMetrics, WeightLogEntry } from "../types";
import { todayStr } from "../utils/date";

const storageKey = (uid: string) => `user_${uid}:body:v1`;

function load(uid: string): BodyMetrics | null {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BodyMetrics;
    if (
      typeof parsed?.heightCm === "number" &&
      typeof parsed?.startWeightKg === "number" &&
      Array.isArray(parsed?.log)
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function save(uid: string, metrics: BodyMetrics | null): void {
  try {
    if (metrics === null) {
      localStorage.removeItem(storageKey(uid));
    } else {
      localStorage.setItem(storageKey(uid), JSON.stringify(metrics));
    }
  } catch {
    /* ignore */
  }
}

export type BodyOnboarding = Omit<
  BodyMetrics,
  "log" | "createdAt" | "updatedAt" | "currentWeightKg"
> & {
  /** Optional first measurement; if omitted we use `startWeightKg`. */
  initialMeasurement?: WeightLogEntry;
};

export interface UseBodyMetricsResult {
  metrics: BodyMetrics | null;
  setOnboarding: (input: BodyOnboarding) => void;
  updateMetrics: (
    patch: Partial<Omit<BodyMetrics, "log" | "createdAt">>
  ) => void;
  addWeight: (weightKg: number, date?: string) => void;
  removeWeight: (date: string) => void;
  reset: () => void;
}

/**
 * Manages body metrics + weight log.
 *
 * Same persistence + sync pattern as `useUserProducts` / `useSavedRecipes`.
 * The blob is a single object, not a list, but the weight log inside is
 * append-only (deduplicated by ISO date).
 */
export function useBodyMetrics(userId: string): UseBodyMetricsResult {
  const [metrics, setMetrics] = useState<BodyMetrics | null>(() => load(userId));

  useEffect(() => {
    setMetrics(load(userId));
  }, [userId]);

  useEffect(() => {
    return subscribeSyncRefreshed((uid) => {
      if (uid !== userId) return;
      setMetrics(load(userId));
    });
  }, [userId]);

  useEffect(() => {
    const key = storageKey(userId);
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage || e.key !== key) return;
      setMetrics(load(userId));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId]);

  const persist = useCallback(
    (next: BodyMetrics | null) => {
      save(userId, next);
      setMetrics(next);
      schedulePush(userId);
    },
    [userId]
  );

  const setOnboarding = useCallback(
    (input: BodyOnboarding) => {
      const now = Date.now();
      const today = todayStr();
      const initial: WeightLogEntry =
        input.initialMeasurement ?? { date: today, weightKg: input.startWeightKg };
      const next: BodyMetrics = {
        name: input.name?.trim() || undefined,
        heightCm: input.heightCm,
        startWeightKg: input.startWeightKg,
        currentWeightKg: initial.weightKg,
        age: input.age,
        sex: input.sex,
        goal: input.goal,
        goalWeightKg: input.goalWeightKg,
        log: [initial],
        createdAt: now,
        updatedAt: now,
      };
      persist(next);
    },
    [persist]
  );

  const updateMetrics = useCallback(
    (patch: Partial<Omit<BodyMetrics, "log" | "createdAt">>) => {
      const current = load(userId);
      if (!current) return;
      const next: BodyMetrics = {
        ...current,
        ...patch,
        updatedAt: Date.now(),
      };
      persist(next);
    },
    [userId, persist]
  );

  const addWeight = useCallback(
    (weightKg: number, date?: string) => {
      if (!Number.isFinite(weightKg) || weightKg <= 0) return;
      const current = load(userId);
      if (!current) return;
      const isoDate = date ?? todayStr();
      const filtered = current.log.filter((e) => e.date !== isoDate);
      const log = [...filtered, { date: isoDate, weightKg }].sort((a, b) =>
        a.date.localeCompare(b.date)
      );
      const last = log[log.length - 1];
      persist({
        ...current,
        log,
        currentWeightKg: last.weightKg,
        updatedAt: Date.now(),
      });
    },
    [userId, persist]
  );

  const removeWeight = useCallback(
    (date: string) => {
      const current = load(userId);
      if (!current) return;
      const log = current.log.filter((e) => e.date !== date);
      const last = log.length > 0 ? log[log.length - 1] : null;
      persist({
        ...current,
        log,
        currentWeightKg: last ? last.weightKg : current.startWeightKg,
        updatedAt: Date.now(),
      });
    },
    [userId, persist]
  );

  const reset = useCallback(() => {
    persist(null);
  }, [persist]);

  return { metrics, setOnboarding, updateMetrics, addWeight, removeWeight, reset };
}
