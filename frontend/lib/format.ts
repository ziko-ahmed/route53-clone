/** Small display helpers used by more than one page. */

/**
 * Turns a timestamp from the API into something readable in the user's
 * own timezone, e.g. "August 14, 2026 at 09:12".
 *
 * The backend sends UTC either as "...T09:12:00+00:00" (Postgres) or as a
 * bare "...T09:12:00" (SQLite). JavaScript reads a bare timestamp as local
 * time, which would silently shift it, so we add the "Z" ourselves when
 * there is no timezone on the end.
 */
export function formatDate(iso: string): string {
  const hasTimezone = /(Z|[+-]\d{2}:?\d{2})$/.test(iso);
  const date = new Date(hasTimezone ? iso : `${iso}Z`);

  if (Number.isNaN(date.getTime())) return iso;

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 300 -> "5 minutes", 172800 -> "2 days". Shown next to raw TTL values. */
export function humanTtl(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  if (seconds < 3600) {
    const minutes = Math.round(seconds / 60);
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  if (seconds < 86400) {
    const hours = Math.round(seconds / 3600);
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  const days = Math.round(seconds / 86400);
  return `${days} day${days === 1 ? "" : "s"}`;
}
