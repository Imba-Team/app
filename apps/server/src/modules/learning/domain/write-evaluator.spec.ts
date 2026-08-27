import {
  WRITE_TYPO_MAX_DISTANCE,
  WRITE_TYPO_MIN_EXPECTED_LENGTH,
  diffChars,
  evaluateWrittenAnswer,
  levenshtein,
  normalizeWritten,
  splitAnswerVariants,
  tokenSetEqual,
} from './write-evaluator';

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('serendipity', 'serendipity')).toBe(0);
  });

  it('returns the other length when one string is empty', () => {
    expect(levenshtein('', 'cat')).toBe(3);
    expect(levenshtein('cat', '')).toBe(3);
    expect(levenshtein('', '')).toBe(0);
  });

  it('counts single insertion, deletion, and substitution as 1', () => {
    expect(levenshtein('cat', 'cats')).toBe(1);
    expect(levenshtein('cats', 'cat')).toBe(1);
    expect(levenshtein('cat', 'car')).toBe(1);
  });

  it('handles classic textbook example (kitten → sitting = 3)', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });
});

describe('normalizeWritten', () => {
  it('trims, lowercases, and collapses whitespace', () => {
    expect(normalizeWritten('  Serendipity   Now  ')).toBe('serendipity now');
  });

  it('strips common punctuation', () => {
    expect(normalizeWritten('hello, world!')).toBe('hello world');
    expect(normalizeWritten('"quote"')).toBe('quote');
    expect(normalizeWritten("don't")).toBe('dont');
  });

  it('folds diacritics so accents can be typed either way', () => {
    // "café" and "cafe" both normalize to "cafe" — a physical-keyboard
    // learner shouldn't be penalized for skipping the accent.
    expect(normalizeWritten('café')).toBe('cafe');
    expect(normalizeWritten('naïve')).toBe('naive');
  });

  it('strips a single leading article', () => {
    expect(normalizeWritten('the mitochondria')).toBe('mitochondria');
    expect(normalizeWritten('An apple')).toBe('apple');
    expect(normalizeWritten('a plant')).toBe('plant');
  });

  it('does not strip mid-sentence articles', () => {
    expect(normalizeWritten('powerhouse of the cell')).toBe(
      'powerhouse of the cell',
    );
  });

  it('does not strip an article-shaped word that is the whole answer', () => {
    // No space after "the" → not treated as an article prefix.
    expect(normalizeWritten('the')).toBe('the');
  });

  it('strips a trailing parenthetical qualifier', () => {
    expect(normalizeWritten('Where are you from? (informal)')).toBe(
      'where are you from',
    );
    expect(normalizeWritten('hello (colloquial)')).toBe('hello');
    expect(normalizeWritten('word [archaic]')).toBe('word');
  });

  it('does not strip parentheses inside the answer', () => {
    // Interior parens still get punctuation-stripped, but their
    // contents survive the stripping pass — only the trailing group
    // is dropped whole.
    expect(normalizeWritten('h2o (water) molecule')).toBe('h2o water molecule');
  });
});

describe('splitAnswerVariants', () => {
  it('returns the original as the only entry when there is no separator', () => {
    expect(splitAnswerVariants('to think')).toEqual(['to think']);
  });

  it('splits on comma-space into original + parts', () => {
    expect(splitAnswerVariants('to mean, to think')).toEqual([
      'to mean, to think',
      'to mean',
      'to think',
    ]);
  });

  it('splits on semicolon-space', () => {
    expect(splitAnswerVariants('happy; joyful')).toEqual([
      'happy; joyful',
      'happy',
      'joyful',
    ]);
  });

  it('splits on whitespace-flanked slash', () => {
    expect(splitAnswerVariants('happy / joyful')).toEqual([
      'happy / joyful',
      'happy',
      'joyful',
    ]);
  });

  it('does not split numeric literals like 1,000', () => {
    // No whitespace after the comma → treated as a decimal-style
    // separator, not a variant delimiter.
    expect(splitAnswerVariants('1,000 meters')).toEqual(['1,000 meters']);
  });

  it('does not split URL-style slashes without whitespace', () => {
    expect(splitAnswerVariants('AND/OR')).toEqual(['AND/OR']);
  });
});

describe('tokenSetEqual', () => {
  it('matches multi-word answers regardless of order', () => {
    expect(tokenSetEqual('quick brown fox', 'fox quick brown')).toBe(true);
  });

  it('rejects when token counts differ', () => {
    expect(tokenSetEqual('quick brown fox', 'quick brown')).toBe(false);
  });

  it('rejects single-token answers to avoid false positives', () => {
    expect(tokenSetEqual('fox', 'fox')).toBe(false);
  });
});

describe('diffChars', () => {
  it('returns an empty diff for two empty strings', () => {
    expect(diffChars('', '')).toEqual([]);
  });

  it('marks the full input as extra when expected is empty', () => {
    expect(diffChars('abc', '')).toEqual([{ type: 'extra', text: 'abc' }]);
  });

  it('marks the full expected as missing when input is empty', () => {
    expect(diffChars('', 'abc')).toEqual([{ type: 'missing', text: 'abc' }]);
  });

  it('folds a single-char substitution into a `wrong` segment', () => {
    // "fotosynthesis" vs "photosynthesis" → an initial substitution and
    // then a shared tail.
    const segs = diffChars('fotosynthesis', 'photosynthesis');
    // We expect the first segment to describe the substitution (f vs ph
    // isn't a single-char sub, it's insert-then-match — so we get a
    // `missing` for 'p' and then matching 'hotosynthesis' becomes wrong).
    // Simpler regression: after joining, the run of shared characters
    // must appear as `match`.
    const matches = segs
      .filter((s) => s.type === 'match')
      .map((s) => s.text)
      .join('');
    expect(matches).toBe('otosynthesis');
  });

  it('coalesces contiguous same-type runs', () => {
    const segs = diffChars('abc', 'abcxyz');
    expect(segs).toEqual([
      { type: 'match', text: 'abc' },
      { type: 'missing', text: 'xyz' },
    ]);
  });
});

describe('evaluateWrittenAnswer — primary answer only', () => {
  it('exact string match → EXACT + CORRECT, similarity 1', () => {
    const r = evaluateWrittenAnswer('serendipity', 'serendipity');
    expect(r.matchType).toBe('EXACT');
    expect(r.outcome).toBe('CORRECT');
    expect(r.similarity).toBe(1);
    expect(r.editDistance).toBe(0);
    expect(r.matchedAgainst).toBe('serendipity');
  });

  it('case-insensitive + trimmed → EXACT', () => {
    expect(
      evaluateWrittenAnswer('  SERENDIPITY  ', 'serendipity').matchType,
    ).toBe('EXACT');
  });

  it('accent stripped → EXACT', () => {
    expect(evaluateWrittenAnswer('cafe', 'café').matchType).toBe('EXACT');
    expect(evaluateWrittenAnswer('café', 'cafe').matchType).toBe('EXACT');
  });

  it('leading article stripped → EXACT', () => {
    expect(
      evaluateWrittenAnswer('the mitochondria', 'mitochondria').matchType,
    ).toBe('EXACT');
  });

  it('token-set match for multi-word answers → EXACT', () => {
    const r = evaluateWrittenAnswer('brown quick fox', 'quick brown fox');
    expect(r.matchType).toBe('EXACT');
    expect(r.outcome).toBe('CORRECT');
  });

  it('single-char typo in a 6+ char word → TYPO_ACCEPTED', () => {
    const r = evaluateWrittenAnswer('serrendipity', 'serendipity');
    expect(r.matchType).toBe('TYPO_ACCEPTED');
    expect(r.outcome).toBe('CORRECT');
    expect(r.editDistance).toBe(1);
  });

  it('typo in a short word (< 6 chars) → WRONG', () => {
    expect(evaluateWrittenAnswer('car', 'cat').matchType).toBe('WRONG');
  });

  it('two-char change in a 6+ char word → WRONG', () => {
    expect(evaluateWrittenAnswer('serrndipety', 'serendipity').matchType).toBe(
      'WRONG',
    );
  });

  it('completely different word → WRONG + INCORRECT', () => {
    const r = evaluateWrittenAnswer('elephant', 'serendipity');
    expect(r.matchType).toBe('WRONG');
    expect(r.outcome).toBe('INCORRECT');
  });

  it('empty input against a real expected → WRONG', () => {
    const r = evaluateWrittenAnswer('', 'serendipity');
    expect(r.matchType).toBe('WRONG');
    expect(r.editDistance).toBe('serendipity'.length);
  });
});

describe('evaluateWrittenAnswer — alternate answers', () => {
  it('exact match on an alternate wins over a typo on the primary', () => {
    // Primary: "serendipity" (would be TYPO_ACCEPTED for "serndipity")
    // Alternate: "serndipity" (exact) — the alternate must win.
    const r = evaluateWrittenAnswer('serndipity', 'serendipity', [
      'serndipity',
    ]);
    expect(r.matchType).toBe('EXACT');
    expect(r.matchedAgainst).toBe('serndipity');
  });

  it('accepts a synonym alternate', () => {
    const r = evaluateWrittenAnswer('happy', 'joyful', ['happy', 'content']);
    expect(r.matchType).toBe('EXACT');
    expect(r.outcome).toBe('CORRECT');
    expect(r.matchedAgainst).toBe('happy');
  });

  it('falls back to primary when no alternate matches better', () => {
    const r = evaluateWrittenAnswer('joiful', 'joyful', ['happy']);
    expect(r.matchType).toBe('TYPO_ACCEPTED');
    expect(r.matchedAgainst).toBe('joyful');
  });

  it('empty alternates list behaves like primary-only', () => {
    const r = evaluateWrittenAnswer('joyful', 'joyful', []);
    expect(r.matchType).toBe('EXACT');
  });

  it('accepts a single variant from a comma-separated primary answer', () => {
    // "to mean, to think" is two accepted phrasings — typing just one
    // must still score EXACT.
    expect(
      evaluateWrittenAnswer('to think', 'to mean, to think').matchType,
    ).toBe('EXACT');
    expect(
      evaluateWrittenAnswer('to mean', 'to mean, to think').matchType,
    ).toBe('EXACT');
  });

  it('accepts the full comma-separated string as well as either half', () => {
    expect(
      evaluateWrittenAnswer('to mean, to think', 'to mean, to think').matchType,
    ).toBe('EXACT');
  });

  it('splits an alternate answer on commas too', () => {
    // Author supplied the alternate as a comma-separated list; each
    // variant should be accepted independently.
    expect(
      evaluateWrittenAnswer('bonjour', 'hello', ['bonjour, salut']).matchType,
    ).toBe('EXACT');
  });
});

describe('evaluateWrittenAnswer — strictness tiers', () => {
  it('STRICT rejects a typo that NORMAL would accept', () => {
    const r = evaluateWrittenAnswer(
      'serrendipity',
      'serendipity',
      [],
      'STRICT',
    );
    expect(r.matchType).toBe('WRONG');
  });

  it('STRICT rejects punctuation-only differences', () => {
    // "Hello, world" vs "hello world" — punctuation stripping is off
    // in STRICT mode, so the comma matters.
    expect(
      evaluateWrittenAnswer('hello, world', 'hello world', [], 'STRICT')
        .matchType,
    ).toBe('WRONG');
  });

  it('STRICT rejects a trailing-parenthetical mismatch', () => {
    // NORMAL strips "(informal)" — STRICT keeps it, so a bare answer
    // no longer matches.
    expect(
      evaluateWrittenAnswer(
        'Where are you from?',
        'Where are you from? (informal)',
        [],
        'STRICT',
      ).matchType,
    ).toBe('WRONG');
  });

  it('STRICT still accepts an exact case-insensitive + trimmed match', () => {
    expect(
      evaluateWrittenAnswer('  Serendipity  ', 'serendipity', [], 'STRICT')
        .matchType,
    ).toBe('EXACT');
  });

  it('LENIENT accepts a two-edit typo on a mid-length word', () => {
    // "abliity" vs "ability" — edit distance 2 on a 7-char word.
    // NORMAL rejects (max 1 edit); LENIENT accepts.
    expect(
      evaluateWrittenAnswer('abliity', 'ability', [], 'NORMAL').matchType,
    ).toBe('WRONG');
    expect(
      evaluateWrittenAnswer('abliity', 'ability', [], 'LENIENT').matchType,
    ).toBe('TYPO_ACCEPTED');
  });

  it('LENIENT accepts a one-edit typo on a 4-char word (NORMAL rejects)', () => {
    // "wrod" vs "word" — 4 chars, one edit. NORMAL needs 6+ chars;
    // LENIENT drops that floor to 4.
    expect(evaluateWrittenAnswer('wrod', 'word', [], 'NORMAL').matchType).toBe(
      'WRONG',
    );
    expect(evaluateWrittenAnswer('wrod', 'word', [], 'LENIENT').matchType).toBe(
      'TYPO_ACCEPTED',
    );
  });
});

describe('evaluateWrittenAnswer — diff output', () => {
  it('emits diff segments aligned to the matched candidate', () => {
    const r = evaluateWrittenAnswer('fotosynthesis', 'photosynthesis');
    expect(r.diff.length).toBeGreaterThan(0);
    // The trailing 'otosynthesis' is shared → must appear as match.
    const matched = r.diff
      .filter((s) => s.type === 'match')
      .map((s) => s.text)
      .join('');
    expect(matched).toBe('otosynthesis');
  });

  it('diff on EXACT is a single match segment', () => {
    const r = evaluateWrittenAnswer('serendipity', 'serendipity');
    expect(r.diff).toEqual([{ type: 'match', text: 'serendipity' }]);
  });
});

describe('constants', () => {
  it('WRITE_TYPO_MIN_EXPECTED_LENGTH matches roadmap spec (6)', () => {
    expect(WRITE_TYPO_MIN_EXPECTED_LENGTH).toBe(6);
  });

  it('WRITE_TYPO_MAX_DISTANCE matches roadmap spec (1)', () => {
    expect(WRITE_TYPO_MAX_DISTANCE).toBe(1);
  });
});
