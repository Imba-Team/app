import { AttemptOutcome } from './card-attempt-event';

export type WriteMatchType = 'EXACT' | 'TYPO_ACCEPTED' | 'WRONG';

export interface WriteEvaluation {
  matchType: WriteMatchType;
  outcome: Extract<AttemptOutcome, 'CORRECT' | 'INCORRECT'>;
  similarity: number;
  editDistance: number;
  normalizedInput: string;
  normalizedExpected: string;
}

export const WRITE_TYPO_MIN_EXPECTED_LENGTH = 6;
export const WRITE_TYPO_MAX_DISTANCE = 1;

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const curr = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr.push(Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost));
    }
    prev = curr;
  }
  return prev[b.length];
}

export function normalizeWritten(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?;:"'`()[\]{}]/g, '');
}

export function evaluateWrittenAnswer(
  userInput: string,
  expected: string,
): WriteEvaluation {
  const normalizedInput = normalizeWritten(userInput);
  const normalizedExpected = normalizeWritten(expected);

  const editDistance = levenshtein(normalizedInput, normalizedExpected);
  const maxLength = Math.max(normalizedInput.length, normalizedExpected.length);
  const similarity = maxLength === 0 ? 1 : 1 - editDistance / maxLength;

  let matchType: WriteMatchType;
  if (editDistance === 0) {
    matchType = 'EXACT';
  } else if (
    editDistance <= WRITE_TYPO_MAX_DISTANCE &&
    normalizedExpected.length >= WRITE_TYPO_MIN_EXPECTED_LENGTH
  ) {
    matchType = 'TYPO_ACCEPTED';
  } else {
    matchType = 'WRONG';
  }

  return {
    matchType,
    outcome: matchType === 'WRONG' ? 'INCORRECT' : 'CORRECT',
    similarity,
    editDistance,
    normalizedInput,
    normalizedExpected,
  };
}
