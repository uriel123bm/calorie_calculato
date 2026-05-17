import { useCallback, useEffect, useState } from "react";
import { schedulePush, subscribeSyncRefreshed } from "../services/sync";
import type { ThemeMode } from "./useDarkMode";

export interface MacroTargets {
  protein: number;
  carbs: number;
  fat: number;
}

export const DEFAULT_MACRO_TARGETS: MacroTargets = {
  protein: 120,
  carbs: 250,
  fat: 70,
};

export interface UserSettings {
  theme?: ThemeMode;
  macroTargets?: MacroTargets;
}

const SETTINGS_KEY = "app:settings:v1";

function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const theme = parsed.theme;
    const mt = parsed.macroTargets as Record<string, unknown> | undefined;
    const macroTargets: MacroTargets | undefined =
      mt && typeof mt.protein === "number" && typeof mt.carbs === "number" && typeof mt.fat === "number"
        ? { protein: mt.protein, carbs: mt.carbs, fat: mt.fat }
        : undefined;
    return {
      theme: (theme === "dark" || theme === "light" || theme === "system") ? theme : undefined,
      macroTargets,
    };
  } catch {
    return {};
  }
}

function saveSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

export function useUserSettings(userId: string): {
  settings: UserSettings;
  patchSettings: (patch: Partial<UserSettings>) => void;
} {
  const [settings, setSettings] = useState<UserSettings>(loadSettings);

  useEffect(() => {
    return subscribeSyncRefreshed((uid) => {
      if (uid !== userId) return;
      setSettings(loadSettings());
    });
  }, [userId]);

  const patchSettings = useCallback(
    (patch: Partial<UserSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        saveSettings(next);
        schedulePush(userId);
        return next;
      });
    },
    [userId]
  );

  return { settings, patchSettings };
}
