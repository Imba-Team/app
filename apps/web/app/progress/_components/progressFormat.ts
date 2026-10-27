/** Server dates are the user's local calendar days (`YYYY-MM-DD`). */
export function formatDay(date: string, options: Intl.DateTimeFormatOptions = {}): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
    ...options,
  });
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function formatPercent(rate: number | null | undefined): string {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}
