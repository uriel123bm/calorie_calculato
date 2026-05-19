import { useCallback, useEffect, useState } from "react";
import { schedulePush, subscribeSyncRefreshed } from "../services/sync";
import type { PersonalPlanAnswers, PersonalPlanRecord, PersonalPlanResult } from "../types/personalPlan";
import { buildPlanResult } from "../utils/tdeeCalculator";
import { mergePersonalPlanBlobs } from "../utils/syncMerge";

const storageKey = (uid: string) => `user_${uid}:personal_plan:v1`;

function load(uid: string): PersonalPlanRecord | null {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersonalPlanRecord;
    if (
      parsed?.answers &&
      parsed?.result &&
      typeof parsed.completedAt === "number"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function save(uid: string, record: PersonalPlanRecord | null): void {
  try {
    if (record === null) {
      localStorage.removeItem(storageKey(uid));
    } else {
      localStorage.setItem(storageKey(uid), JSON.stringify(record));
    }
  } catch {
    /* ignore */
  }
}

export interface UsePersonalPlanResult {
  plan: PersonalPlanRecord | null;
  hasCompletedPlan: boolean;
  savePlan: (answers: PersonalPlanAnswers, result?: PersonalPlanResult) => PersonalPlanRecord;
  clearPlan: () => void;
}

export function usePersonalPlan(userId: string): UsePersonalPlanResult {
  const [plan, setPlan] = useState<PersonalPlanRecord | null>(() => load(userId));

  useEffect(() => {
    setPlan(load(userId));
  }, [userId]);

  useEffect(() => {
    return subscribeSyncRefreshed((uid) => {
      if (uid !== userId) return;
      setPlan(load(userId));
    });
  }, [userId]);

  useEffect(() => {
    const key = storageKey(userId);
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage || e.key !== key) return;
      setPlan(load(userId));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId]);

  const persist = useCallback(
    (next: PersonalPlanRecord | null) => {
      save(userId, next);
      setPlan(next);
      schedulePush(userId);
    },
    [userId]
  );

  const savePlan = useCallback(
    (answers: PersonalPlanAnswers, result?: PersonalPlanResult): PersonalPlanRecord => {
      const computed = result ?? buildPlanResult(answers);
      const record: PersonalPlanRecord = {
        answers,
        result: computed,
        completedAt: Date.now(),
      };
      persist(record);
      return record;
    },
    [persist]
  );

  const clearPlan = useCallback(() => {
    persist(null);
  }, [persist]);

  return {
    plan,
    hasCompletedPlan: plan != null,
    savePlan,
    clearPlan,
  };
}

/** Used by sync pull to merge remote/local personal plan blobs. */
export function writePersonalPlanFromSync(
  uid: string,
  localRaw: unknown,
  remoteRaw: unknown
): PersonalPlanRecord | null {
  const merged = mergePersonalPlanBlobs(localRaw, remoteRaw);
  save(uid, merged);
  return merged;
}
