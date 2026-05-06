const MAX_RECENT = 10;
const STORAGE_KEY = "app:recentIngredients";

export function getRecentIngredients(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function addRecentIngredient(name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  try {
    const current = getRecentIngredients().filter((n) => n !== trimmed);
    const updated = [trimmed, ...current].slice(0, MAX_RECENT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    /* ignore quota errors */
  }
}

export function clearRecentIngredients(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
