/**
 * Directions a client can actually echo on a per-card submission. The
 * Prisma `LearnAnswerDirection` enum has a third value, MIXED, but
 * that's a *preference* — it means "roll a direction per card at
 * batch time". Per-card submissions always carry one of the two
 * concrete values, so we validate against this narrower tuple.
 */
export const RESOLVED_ANSWER_DIRECTIONS = [
  'TERM_TO_DEFINITION',
  'DEFINITION_TO_TERM',
] as const;

export type ResolvedAnswerDirection =
  (typeof RESOLVED_ANSWER_DIRECTIONS)[number];
