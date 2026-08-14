"use client";

import { useEffect, useState } from "react";

/**
 * Waits until the user stops typing before returning the new value, so we
 * do not fire a request on every keystroke in the search box.
 */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
