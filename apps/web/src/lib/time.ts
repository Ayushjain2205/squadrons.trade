/** Relative labels for agent list timestamps. */
export function formatRelativeTime(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "";

  const now = Date.now();
  // Guard absurd future/past from bad clocks or seed data
  const delta = Math.abs(now - timestamp);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (delta < minute) return "now";
  if (delta < hour) return `${Math.floor(delta / minute)}m`;
  if (delta < day) return `${Math.floor(delta / hour)}h`;
  if (delta < 7 * day) return `${Math.floor(delta / day)}d`;

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
}

export function formatClock(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
}
