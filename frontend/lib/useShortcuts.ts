"use client";

import { useEffect } from "react";

export type Shortcut = {
  /** The key to listen for, e.g. "c" or "/" or "?". */
  key: string;
  description: string;
  run: () => void;
};

/**
 * True when the user is typing, so a shortcut should not steal the key.
 * Without this, typing "create" in the search box would fire the "c"
 * shortcut five times.
 */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}

/** Binds a list of single-key shortcuts for as long as the component is mounted. */
export function useShortcuts(shortcuts: Shortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      // Leave browser and OS combinations alone.
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;

      const match = shortcuts.find((s) => s.key === event.key);
      if (!match) return;

      event.preventDefault();
      match.run();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcuts, enabled]);
}
