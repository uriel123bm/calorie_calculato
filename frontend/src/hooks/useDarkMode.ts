import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "system" | "light" | "dark";

/** Shared localStorage key — matches useUserSettings and sync.ts SETTINGS_KEY. */
const SETTINGS_KEY = "app:settings:v1";

function readThemeFromStorage(): ThemeMode {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return "system";
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const t = parsed.theme;
    if (t === "dark" || t === "light" || t === "system") return t;
  } catch { /* ignore */ }
  return "system";
}

function writeThemeToStorage(mode: ThemeMode): void {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const existing = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...existing, theme: mode }));
  } catch { /* ignore */ }
}

export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  if (mode === "dark") {
    root.setAttribute("data-theme", "dark");
  } else if (mode === "light") {
    root.setAttribute("data-theme", "light");
  } else {
    root.removeAttribute("data-theme");
  }
}

export function useDarkMode(): {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  isDark: boolean;
} {
  const [mode, setModeState] = useState<ThemeMode>(readThemeFromStorage);

  useEffect(() => {
    applyTheme(mode);
    writeThemeToStorage(mode);
  }, [mode]);

  const setMode = useCallback((m: ThemeMode) => setModeState(m), []);

  const isDark =
    mode === "dark" ||
    (mode === "system" && typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  return { mode, setMode, isDark };
}
