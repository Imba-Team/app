import { AttemptOutcome } from './card-attempt-event';

export type WriteMatchType = 'EXACT' | 'TYPO_ACCEPTED' | 'WRONG';

export type DiffSegmentType = 'match' | 'wrong' | 'missing' | 'extra';

export interface DiffSegment {
  type: DiffSegmentType;
  text: string;
}

export interface WriteEvaluation {
  matchType: WriteMatchType;
  outcome: Extract<AttemptOutcome, 'CORRECT' | 'INCORRECT'>;
  similarity: number;
  editDistance: number;
  normalizedInput: string;
  normalizedExpected: string;
  /**
   * Which candidate answer the input was scored against — the primary
   * `expected` or one of the alternates. The UI uses this to show the
   * learner what they actually landed on (e.g. an accepted synonym).
   */
  matchedAgainst: string;
  /**
   * Segment-by-segment diff of the input vs the matched answer, aligned
   * on the normalized forms. The UI uses this to render "you wrote
   * fotosynthesis, expected photosynthesis" without doing its own diff.
   *
   * `match` segments appear identically in both. `wrong` segments are
   * in the input but not the expected (character substitutions). `extra`
   * are trailing/inserted input characters. `missing` are expected
   * characters the learner omitted.
   */
  diff: DiffSegment[];
}

export const WRITE_TYPO_MIN_EXPECTED_LENGTH = 6;
export const WRITE_TYPO_MAX_DISTANCE = 1;

/** Wider tier used when strictness is LENIENT — half-length words are
 *  eligible and up to two edits count as a typo. Beyond that the
 *  edits stop being "typos" in any useful sense. */
export const WRITE_LENIENT_TYPO_MIN_EXPECTED_LENGTH = 4;
export const WRITE_LENIENT_TYPO_MAX_DISTANCE = 2;

/** Leading articles stripped during normalization so "the mitochondria"
 *  and "mitochondria" score identically. Kept intentionally short — we
 *  don't want to normalize away meaningful function words. */
const STRIP_LEADING_ARTICLES = new Set(['a', 'an', 'the']);

/**
 * Three-tier strictness for the evaluator.
 *  - STRICT: literal comparison after case-insensitive + trim +
 *    whitespace-collapse only. No leniency at all.
 *  - NORMAL: current defaults (article strip, diacritic fold, bracket
 *    strip, punctuation strip, comma-variant split, token-set match,
 *    1-edit typo tolerance on 6+ char words).
 *  - LENIENT: NORMAL + wider typo tolerance (2 edits on 4+ chars).
 */
export type Strictness = 'STRICT' | 'NORMAL' | 'LENIENT';
export const DEFAULT_STRICTNESS: Strictness = 'NORMAL';

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

/**
 * Fold combining marks so "café" compares equal to "cafe". Learners
 * shouldn't be penalized for skipping diacritics on a physical keyboard;
 * cards that genuinely need the accent can still be added as an
 * alternateAnswer to accept both forms.
 */
function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function normalizeWritten(
  s: string,
  strictness: Strictness = DEFAULT_STRICTNESS,
): string {
  // STRICT: skip every leniency pass. Only case-insensitive + trim +
  // whitespace-collapse survive — the minimum needed for a literal
  // comparison to work usefully.
  if (strictness === 'STRICT') {
    return s.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  // Strip a trailing parenthetical / bracketed qualifier BEFORE the
  // punctuation pass, so "Where are you from? (informal)" collapses to
  // the same shape a learner would produce typing just "Where are you
  // from?". Only the *trailing* group is removed so mid-answer
  // parentheses (rare but legitimate, e.g. "H2O (water)") don't lose
  // their inner text.
  let out = stripDiacritics(s)
    .trim()
    .replace(/\s*[([{][^)\]}]*[)\]}]\s*$/, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?;:"'`()[\]{}]/g, '')
    .trim();

  // Strip a single leading article — enough for "the ability to X"
  // vs "ability to X" without touching mid-sentence articles.
  const firstSpace = out.indexOf(' ');
  if (firstSpace > 0) {
    const first = out.slice(0, firstSpace);
    if (STRIP_LEADING_ARTICLES.has(first)) {
      out = out.slice(firstSpace + 1);
    }
  }
  return out;
}

/**
 * Order-independent multi-word match. Splits both strings on whitespace
 * and compares the resulting sets — "quick brown fox" matches "fox
 * quick brown" but not "quick brown". Only triggered for answers with
 * ≥ 2 tokens on both sides so single-word cards don't accidentally
 * match unrelated single words.
 */
export function tokenSetEqual(a: string, b: string): boolean {
  const at = a.split(' ').filter(Boolean);
  const bt = b.split(' ').filter(Boolean);
  if (at.length < 2 || bt.length < 2) return false;
  if (at.length !== bt.length) return false;
  const seen = new Set(at);
  return bt.every((t) => seen.has(t));
}

/**
 * Character-level diff between the input and the expected answer,
 * driven by a standard LCS traceback. Emits contiguous segments so the
 * UI can render each run with its own styling instead of colouring
 * every character individually.
 */
export function diffChars(input: string, expected: string): DiffSegment[] {
  const n = input.length;
  const m = expected.length;

  if (n === 0 && m === 0) return [];
  if (n === 0) return [{ type: 'missing', text: expected }];
  if (m === 0) return [{ type: 'extra', text: input }];

  // Standard LCS DP table.
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array<number>(m + 1).fill(0),
  );
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      dp[i][j] =
        input[i - 1] === expected[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Traceback: produce ops from end to start, then reverse.
  type Op = { kind: 'match' | 'extra' | 'missing'; ch: string };
  const ops: Op[] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (input[i - 1] === expected[j - 1]) {
      ops.push({ kind: 'match', ch: input[i - 1] });
      i -= 1;
      j -= 1;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      ops.push({ kind: 'extra', ch: input[i - 1] });
      i -= 1;
    } else {
      ops.push({ kind: 'missing', ch: expected[j - 1] });
      j -= 1;
    }
  }
  while (i > 0) {
    ops.push({ kind: 'extra', ch: input[i - 1] });
    i -= 1;
  }
  while (j > 0) {
    ops.push({ kind: 'missing', ch: expected[j - 1] });
    j -= 1;
  }
  ops.reverse();

  // Coalesce runs. Also fold an adjacent extra+missing pair into a
  // single `wrong` segment so a single-char substitution reads as one
  // wrong character instead of "extra X, missing Y".
  const segments: DiffSegment[] = [];
  const push = (type: DiffSegmentType, text: string) => {
    const last = segments[segments.length - 1];
    if (last && last.type === type) last.text += text;
    else segments.push({ type, text });
  };

  let k = 0;
  while (k < ops.length) {
    const op = ops[k];
    if (
      (op.kind === 'extra' && ops[k + 1]?.kind === 'missing') ||
      (op.kind === 'missing' && ops[k + 1]?.kind === 'extra')
    ) {
      // Substitution — the wrong char is whichever side came from `input`.
      const wrongCh = op.kind === 'extra' ? op.ch : ops[k + 1].ch;
      push('wrong', wrongCh);
      k += 2;
      continue;
    }
    push(op.kind, op.ch);
    k += 1;
  }
  return segments;
}

interface CandidateScore {
  candidate: string;
  matchType: WriteMatchType;
  editDistance: number;
  similarity: number;
}

function scoreAgainst(
  normalizedInput: string,
  normalizedCandidate: string,
  strictness: Strictness,
): CandidateScore {
  const editDistance = levenshtein(normalizedInput, normalizedCandidate);
  const maxLength = Math.max(
    normalizedInput.length,
    normalizedCandidate.length,
  );
  const similarity = maxLength === 0 ? 1 : 1 - editDistance / maxLength;

  let matchType: WriteMatchType;
  if (editDistance === 0) {
    matchType = 'EXACT';
  } else if (strictness === 'STRICT') {
    // Literal-only tier — any non-zero edit distance is WRONG.
    matchType = 'WRONG';
  } else if (tokenSetEqual(normalizedInput, normalizedCandidate)) {
    matchType = 'EXACT';
  } else {
    const typoMinLength =
      strictness === 'LENIENT'
        ? WRITE_LENIENT_TYPO_MIN_EXPECTED_LENGTH
        : WRITE_TYPO_MIN_EXPECTED_LENGTH;
    const typoMaxDistance =
      strictness === 'LENIENT'
        ? WRITE_LENIENT_TYPO_MAX_DISTANCE
        : WRITE_TYPO_MAX_DISTANCE;
    if (
      editDistance <= typoMaxDistance &&
      normalizedCandidate.length >= typoMinLength
    ) {
      matchType = 'TYPO_ACCEPTED';
    } else {
      matchType = 'WRONG';
    }
  }

  return {
    candidate: normalizedCandidate,
    matchType,
    editDistance,
    similarity,
  };
}

const MATCH_RANK: Record<WriteMatchType, number> = {
  EXACT: 0,
  TYPO_ACCEPTED: 1,
  WRONG: 2,
};

/**
 * Split a candidate answer into its comma / semicolon / slash-separated
 * variants — a definition like "to mean, to think" is really two
 * accepted answers, and a learner who typed only one shouldn't be
 * marked wrong. We require whitespace on at least one side of the
 * separator so numeric literals like "1,000" don't get chopped up.
 *
 * The full original is always included as the first candidate so a
 * learner who does type the whole thing still hits EXACT.
 */
export function splitAnswerVariants(
  raw: string,
  strictness: Strictness = DEFAULT_STRICTNESS,
): string[] {
  // STRICT: no splitting — the full string is the only accepted form.
  if (strictness === 'STRICT') return [raw];
  const parts = raw
    .split(/\s*[;,]\s+|\s+\/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return [raw];
  return [raw, ...parts];
}

/**
 * Score `userInput` against a primary expected answer plus any
 * author-provided alternates, and return the best-matching candidate.
 * The written evaluator picks EXACT over TYPO_ACCEPTED over WRONG, and
 * within a tier prefers the candidate with the lowest edit distance —
 * so an alternate that matches exactly wins over the primary if the
 * primary only matches with a typo.
 *
 * `strictness` selects the leniency tier applied to normalization,
 * variant-splitting, and typo tolerance. Defaults to NORMAL for
 * backwards compat with older call sites.
 */
export function evaluateWrittenAnswer(
  userInput: string,
  expected: string,
  alternateAnswers: string[] = [],
  strictness: Strictness = DEFAULT_STRICTNESS,
): WriteEvaluation {
  const normalizedInput = normalizeWritten(userInput, strictness);
  // Expand each raw candidate on comma/semicolon/slash-with-whitespace
  // so multi-value definitions accept any single variant. Dedupe on
  // the raw string to avoid double-scoring identical variants.
  const rawCandidates = Array.from(
    new Set(
      [expected, ...alternateAnswers].flatMap((raw) =>
        splitAnswerVariants(raw, strictness),
      ),
    ),
  );
  const candidates = rawCandidates.map((raw) => ({
    raw,
    normalized: normalizeWritten(raw, strictness),
  }));

  const scored = candidates.map((c) => ({
    raw: c.raw,
    normalized: c.normalized,
    ...scoreAgainst(normalizedInput, c.normalized, strictness),
  }));

  // Best = lowest match rank, break ties on edit distance.
  scored.sort((a, b) => {
    const rank = MATCH_RANK[a.matchType] - MATCH_RANK[b.matchType];
    if (rank !== 0) return rank;
    return a.editDistance - b.editDistance;
  });
  const best = scored[0];

  return {
    matchType: best.matchType,
    outcome: best.matchType === 'WRONG' ? 'INCORRECT' : 'CORRECT',
    similarity: best.similarity,
    editDistance: best.editDistance,
    normalizedInput,
    normalizedExpected: best.normalized,
    matchedAgainst: best.raw,
    diff: diffChars(normalizedInput, best.normalized),
  };
}
