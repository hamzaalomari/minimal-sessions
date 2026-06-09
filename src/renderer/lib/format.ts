/** Formats a token count into a compact display string: 999, 1.2K, 12K, 200K. */
export function fmtTokens(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return k.toFixed(n >= 10_000 ? 0 : 1) + 'K';
}

/**
 * Formats `ts` as a short relative time vs. `now`: "now", "2m", "1h", "yesterday", "3d", or
 * the absolute date for anything older than a week.
 */
export function fmtRelativeTime(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const SEC = 1000;
  const MIN = 60 * SEC;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  if (diff < MIN) return 'now';
  if (diff < HOUR) return `${Math.floor(diff / MIN)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  if (diff < 2 * DAY) return 'yesterday';
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d`;
  return new Date(ts).toLocaleDateString();
}
