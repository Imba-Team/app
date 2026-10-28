/**
 * Maximum lengths for user text. Mirrors `textLimits` in
 * apps/server/src/common/text/text-limits.ts — the server rejects
 * anything longer with a 400, so inputs cap at the same values.
 */
export const textLimits = {
  cardTerm: 500,
  cardDefinition: 5000,
  setTitle: 200,
  setDescription: 2000,
  language: 50,
  displayName: 50,
} as const;
