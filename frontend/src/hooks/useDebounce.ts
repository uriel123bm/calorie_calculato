import { useEffect, useState } from "react";

/**
 * Returns a debounced version of `value` that only updates
 * after `delayMs` milliseconds of inactivity.
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
