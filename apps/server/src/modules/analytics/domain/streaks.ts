import { addDaysToDateString } from 'src/common/time/timezone.util';

export interface Streaks {
  currentStreak: number;
  bestStreak: number;
  studiedToday: boolean;
}

/**
 * Current and best run of consecutive study days.
 *
 * `studyDates` are the user's local calendar days (`YYYY-MM-DD`) with at
 * least one answer, in any order, duplicates allowed. The current streak
 * counts back from `today`, or from yesterday when nothing has been
 * studied yet today — the day isn't over, so the streak isn't broken.
 */
export function computeStreaks(studyDates: string[], today: string): Streaks {
  const days = new Set(studyDates);
  const studiedToday = days.has(today);

  let currentStreak = 0;
  let cursor = studiedToday ? today : addDaysToDateString(today, -1);
  while (days.has(cursor)) {
    currentStreak++;
    cursor = addDaysToDateString(cursor, -1);
  }

  let bestStreak = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of [...days].sort()) {
    run = previous && addDaysToDateString(previous, 1) === day ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    previous = day;
  }

  return { currentStreak, bestStreak, studiedToday };
}
