/** Small display helpers used by more than one page. */

/** "2026-08-14T09:12:00" -> "August 14, 2026, 09:12 (UTC)" */
export function formatDate(iso: string): string {
  const date = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
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
