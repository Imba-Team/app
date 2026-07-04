import {
  WRITE_TYPO_MAX_DISTANCE,
  WRITE_TYPO_MIN_EXPECTED_LENGTH,
  evaluateWrittenAnswer,
  levenshtein,
  normalizeWritten,
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

  it('counts single insertion as 1', () => {
    expect(levenshtein('cat', 'cats')).toBe(1);
  });

  it('counts single deletion as 1', () => {
    expect(levenshtein('cats', 'cat')).toBe(1);
  });

  it('counts single substitution as 1', () => {
    expect(levenshtein('cat', 'car')).toBe(1);
  });

  it('is symmetric', () => {
    expect(levenshtein('serendipity', 'serrendipity')).toBe(
      levenshtein('serrendipity', 'serendipity'),
    );
  });

  it('handles classic textbook example (kitten → sitting = 3)', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });

  it('handles a realistic multi-word case', () => {
    expect(
      levenshtein('the ability to remember', 'the ablility to remember'),
    ).toBe(1);
  });
});

describe('normalizeWritten', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeWritten('  hello  ')).toBe('hello');
  });

  it('lowercases', () => {
    expect(normalizeWritten('Serendipity')).toBe('serendipity');
  });

  it('collapses internal whitespace', () => {
    expect(normalizeWritten('the   ability   to   remember')).toBe(
      'the ability to remember',
    );
  });

  it('strips common punctuation', () => {
    expect(normalizeWritten('hello, world!')).toBe('hello world');
    expect(normalizeWritten('"quote"')).toBe('quote');
    expect(normalizeWritten("don't")).toBe('dont');
  });

  it('preserves diacritics — foreign-language answers must not lose accents', () => {
    expect(normalizeWritten('café')).toBe('café');
    expect(normalizeWritten('naïve')).toBe('naïve');
  });
});

describe('evaluateWrittenAnswer', () => {
  describe('EXACT match', () => {
    it('exact string match → EXACT + CORRECT, similarity 1', () => {
      const r = evaluateWrittenAnswer('serendipity', 'serendipity');
      expect(r.matchType).toBe('EXACT');
      expect(r.outcome).toBe('CORRECT');
      expect(r.similarity).toBe(1);
      expect(r.editDistance).toBe(0);
    });

    it('case-insensitive → EXACT', () => {
      expect(
        evaluateWrittenAnswer('SERENDIPITY', 'serendipity').matchType,
      ).toBe('EXACT');
    });

    it('surrounding whitespace ignored → EXACT', () => {
      expect(
        evaluateWrittenAnswer('  serendipity  ', 'serendipity').matchType,
      ).toBe('EXACT');
    });

    it('punctuation ignored → EXACT', () => {
      expect(
        evaluateWrittenAnswer('hello, world!', 'hello world').matchType,
      ).toBe('EXACT');
    });

    it('two empty strings → EXACT with similarity 1', () => {
      const r = evaluateWrittenAnswer('', '');
      expect(r.matchType).toBe('EXACT');
      expect(r.similarity).toBe(1);
    });
  });

  describe('TYPO_ACCEPTED (Levenshtein tolerance)', () => {
    it('single-char typo in a 6+ char word → TYPO_ACCEPTED + CORRECT', () => {
      const r = evaluateWrittenAnswer('serrendipity', 'serendipity');
      expect(r.matchType).toBe('TYPO_ACCEPTED');
      expect(r.outcome).toBe('CORRECT');
      expect(r.editDistance).toBe(1);
      expect(r.similarity).toBeGreaterThan(0.9);
    });

    it('single-char deletion in a 6+ char word → TYPO_ACCEPTED', () => {
      expect(evaluateWrittenAnswer('serndipity', 'serendipity').matchType).toBe(
        'TYPO_ACCEPTED',
      );
    });

    it('single-char substitution in a 6+ char word → TYPO_ACCEPTED', () => {
      expect(
        evaluateWrittenAnswer('serendipety', 'serendipity').matchType,
      ).toBe('TYPO_ACCEPTED');
    });

    it('typo in a 6-char word (boundary case) → TYPO_ACCEPTED', () => {
      // "kitten" is exactly 6 chars; one-edit change should be accepted
      expect(evaluateWrittenAnswer('kittn', 'kitten').matchType).toBe(
        'TYPO_ACCEPTED',
      );
    });

    it('typo in a short word (< 6 chars) → WRONG', () => {
      // "cat" (3 chars) — even a single edit is not forgiven, since short words
      // have too many plausible neighbours to safely accept typos.
      expect(evaluateWrittenAnswer('car', 'cat').matchType).toBe('WRONG');
    });

    it('two-char change in a 6+ char word → WRONG (over max distance)', () => {
      // Two substitutions is beyond the tolerance limit.
      expect(
        evaluateWrittenAnswer('serrndipety', 'serendipity').matchType,
      ).toBe('WRONG');
    });
  });

  describe('WRONG', () => {
    it('completely different word → WRONG + INCORRECT', () => {
      const r = evaluateWrittenAnswer('elephant', 'serendipity');
      expect(r.matchType).toBe('WRONG');
      expect(r.outcome).toBe('INCORRECT');
      expect(r.similarity).toBeLessThan(0.5);
    });

    it('empty user input against a real expected → WRONG', () => {
      const r = evaluateWrittenAnswer('', 'serendipity');
      expect(r.matchType).toBe('WRONG');
      expect(r.outcome).toBe('INCORRECT');
      expect(r.editDistance).toBe('serendipity'.length);
      expect(r.similarity).toBe(0);
    });
  });

  describe('output fields', () => {
    it('exposes normalized versions of both strings for frontend diffing', () => {
      const r = evaluateWrittenAnswer('  Serendipity!  ', 'Serendipity');
      expect(r.normalizedInput).toBe('serendipity');
      expect(r.normalizedExpected).toBe('serendipity');
    });

    it('similarity is 1 - editDistance / max(len)', () => {
      const r = evaluateWrittenAnswer('cats', 'cat');
      expect(r.editDistance).toBe(1);
      expect(r.similarity).toBeCloseTo(1 - 1 / 4, 5);
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
});
