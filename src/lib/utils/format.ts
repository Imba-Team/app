/**
 * Compact number formatter — 1.2K, 3.4M, etc.
 * Falls back to plain toString for very small numbers.
 */
export function formatCompact(value: number, locale = 'en'): string {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  );
}

/** e.g. 0.42 -> "42%". Clamps to [0, 1]. */
export function formatPercent(fraction: number, locale = 'en'): string {
  const clamped = Math.max(0, Math.min(1, fraction));
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(
    clamped,
  );
}

/** e.g. 90 -> "1m 30s", 3600 -> "1h 0m". */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
