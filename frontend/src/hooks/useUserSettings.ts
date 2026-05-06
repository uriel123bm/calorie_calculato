import { useCallback, useEffect, useState } from "react";
import { schedulePush, subscribeSyncRefreshed } from "../services/sync";
import type { ThemeMode } from "./useDarkMode";

export interface UserSettings {
  theme?: ThemeMode;
}

const SETTINGS_KEY = "app:settings:v1";

function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const theme = parsed.theme;
    return {
      theme: (theme === "dark" || theme === "light" || theme === "system") ? theme : undefined,
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
