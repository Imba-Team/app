"use client";

import { useEffect, useState } from "react";

/**
 * Debounce a rapidly-changing value (typically a search input). The
 * returned value only updates after `delay` ms of stability.
 *
 * The trimmed empty string is treated as a special case — cleared
 * inputs propagate immediately so guards like `q?.trim() && …` don't
 * see the old query flash back briefly.
 */
export function useDebouncedValue<T extends string>(
  value: T,
  delay = 250,
): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (value.trim() === "") return;
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return value.trim() === "" ? value : debounced;
}
