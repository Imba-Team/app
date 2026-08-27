/**
 * Small IANA-timezone helpers used by SRS + reminders.
 *
 * We deliberately don't pull in date-fns-tz or luxon just for two
 * functions — the `Intl.DateTimeFormat` API in Node 18+ is enough as
 * long as we're careful with the arithmetic.
 */

/**
 * Return the UTC `Date` that corresponds to 00:00 in the given IANA
 * timezone on the same *local* day as `reference`.
 *
 * Example: `startOfLocalDayInUtc('Europe/Berlin', new Date('2026-08-06T22:00:00Z'))`
 * returns `2026-08-06T22:00:00Z` (which is 2026-08-07 00:00 local for
 * Berlin — the *next* local day started two hours before the reference
 * in UTC).
 *
 * Falls back to UTC midnight if the zone is unrecognised, so a bad
 * saved value can never break SRS queries.
 */
export function startOfLocalDayInUtc(
  timeZone: string,
  reference: Date = new Date(),
): Date {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(reference);

    const map: Record<string, string> = {};
    for (const p of parts) map[p.type] = p.value;
    const year = Number(map.year);
    const month = Number(map.month);
    const day = Number(map.day);
    // Reading "hour" as "24" is legal in Intl output for midnight in
    // some zones — normalise to 0 so Date.UTC doesn't roll the day.
    const hour = Number(map.hour) % 24;
    const minute = Number(map.minute);
    const second = Number(map.second);

    // `asIfUtc` treats the local wall time as if it were UTC — the
    // difference from the real UTC reference is the zone's current
    // offset in ms (positive for zones east of UTC).
    const asIfUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    const offset = asIfUtc - reference.getTime();

    // Local midnight expressed in UTC = local date at 00:00, then
    // shifted back by the offset so it points at the correct instant.
    const localMidnight = Date.UTC(year, month - 1, day, 0, 0, 0);
    return new Date(localMidnight - offset);
  } catch {
    const fallback = new Date(reference);
    fallback.setUTCHours(0, 0, 0, 0);
    return fallback;
  }
}

/**
 * Return the current hour (0-23) as observed in the given IANA
 * timezone. Used by the SRS reminder fan-out to gate delivery to
 * users whose local morning matches the reminder hour.
 *
 * Falls back to UTC hour on unrecognised zones.
 */
export function localHour(
  timeZone: string,
  reference: Date = new Date(),
): number {
  try {
    const hourStr = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      hour12: false,
    }).format(reference);
    // Some locales emit "24" for midnight — normalise.
    return Number(hourStr) % 24;
  } catch {
    return reference.getUTCHours();
  }
}
