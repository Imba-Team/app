import { shuffle } from './shuffle';

interface CardShape {
  id: string;
  /** The text learners will see as an MC choice — the definition in
   *  forward mode, the term in reverse mode. Which side is passed in
   *  is a caller decision; the picker just needs consistent shape. */
  answerText: string;
}

/**
 * Pick up to `count` distractor answers for a multiple-choice prompt.
 * Bias toward answers whose length is close to the correct one —
 * same-length options are harder to eliminate by shape alone, so the
 * learner is forced to think about meaning.
 *
 * Length bucket is a coarse ±25% window around the correct answer's
 * length. When the bucket doesn't have enough candidates, we widen to
 * the full pool and shuffle the remainder in. Deterministic ordering
 * is preserved within the shuffled halves so different callers of
 * `shuffle` share the same random source.
 */
export function pickDistractors(
  answerCard: CardShape,
  pool: readonly CardShape[],
  count: number,
): string[] {
  const answerLen = answerCard.answerText.length;
  const lowerBound = Math.max(0, Math.floor(answerLen * 0.75));
  const upperBound = Math.ceil(answerLen * 1.25);

  // Dedupe by answer text — two different cards with identical
  // answer text would produce a "correct" distractor. Also exclude
  // the answer itself.
  const seen = new Set<string>([answerCard.answerText]);
  const preferred: string[] = [];
  const rest: string[] = [];

  for (const other of pool) {
    if (other.id === answerCard.id) continue;
    if (seen.has(other.answerText)) continue;
    seen.add(other.answerText);

    const len = other.answerText.length;
    if (len >= lowerBound && len <= upperBound) {
      preferred.push(other.answerText);
    } else {
      rest.push(other.answerText);
    }
  }

  const bucketed = shuffle(preferred).slice(0, count);
  if (bucketed.length >= count) return bucketed;

  // Widen to random from the rest of the pool.
  const remaining = count - bucketed.length;
  return [...bucketed, ...shuffle(rest).slice(0, remaining)];
}
