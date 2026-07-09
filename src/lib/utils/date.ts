import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';

/** Formats an ISO date string using the given pattern (default: 'PP' — e.g. "Jul 8, 2026"). */
export function formatDate(iso: string | Date, pattern = 'PP'): string {
  const date = typeof iso === 'string' ? parseISO(iso) : iso;
  return format(date, pattern);
}

/** e.g. "5 minutes ago", "2 hours ago", "3 days ago" — no suffix by default. */
export function relativeTime(iso: string | Date, options?: { addSuffix?: boolean }): string {
  const date = typeof iso === 'string' ? parseISO(iso) : iso;
  return formatDistanceToNowStrict(date, { addSuffix: options?.addSuffix ?? true });
}

/** Returns YYYY-MM-DD in the user's local timezone. Used for SRS due-date grouping. */
export function toLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
