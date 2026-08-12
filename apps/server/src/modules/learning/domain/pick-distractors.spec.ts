import { pickDistractors } from './pick-distractors';

const c = (id: string, answerText: string) => ({ id, answerText });

describe('pickDistractors', () => {
  it('returns at most `count` distractors', () => {
    const answer = c('a', 'x'.repeat(10));
    const pool = [
      c('b', 'y'.repeat(10)),
      c('c', 'z'.repeat(10)),
      c('d', 'w'.repeat(10)),
    ];
    expect(pickDistractors(answer, pool, 3)).toHaveLength(3);
    expect(pickDistractors(answer, pool, 2)).toHaveLength(2);
  });

  it('excludes the answer itself', () => {
    const answer = c('a', 'xxxxx');
    const pool = [c('a', 'xxxxx'), c('b', 'yyyyy'), c('c', 'zzzzz')];
    const out = pickDistractors(answer, pool, 3);
    expect(out).not.toContain('xxxxx');
  });

  it('dedupes definitions', () => {
    const answer = c('a', 'aaa');
    const pool = [
      c('b', 'same'),
      c('c', 'same'),
      c('d', 'unique-1'),
      c('e', 'unique-2'),
    ];
    const out = pickDistractors(answer, pool, 3);
    // "same" can appear at most once.
    expect(out.filter((s) => s === 'same').length).toBeLessThanOrEqual(1);
    // With 3 distinct definitions in the pool, we can get all 3.
    expect(out.length).toBe(3);
  });

  it('prefers same-length distractors before widening', () => {
    const answer = c('a', 'x'.repeat(10)); // length 10
    // 3 same-length distractors + 3 wildly-different-length distractors.
    const preferred = [
      c('b', 'a'.repeat(10)),
      c('c', 'b'.repeat(10)),
      c('d', 'c'.repeat(10)),
    ];
    const outliers = [
      c('e', 'ee'),
      c('f', 'f'.repeat(50)),
      c('g', 'g'.repeat(60)),
    ];
    const out = pickDistractors(answer, [...outliers, ...preferred], 3);
    // All three picks must come from the length-matched preferred set.
    for (const s of out) {
      expect(['a'.repeat(10), 'b'.repeat(10), 'c'.repeat(10)]).toContain(s);
    }
  });

  it('widens to the remaining pool when the length bucket is too small', () => {
    const answer = c('a', 'x'.repeat(10));
    const pool = [
      c('b', 'y'.repeat(10)), // in bucket
      c('c', 'short'), // outside
      c('d', 'longer distinct'), // outside
    ];
    const out = pickDistractors(answer, pool, 3);
    expect(out.length).toBe(3);
    expect(out).toContain('y'.repeat(10));
  });

  it('returns fewer than count when the pool cannot fill', () => {
    const answer = c('a', 'xxxxx');
    const pool = [c('b', 'yyyyy')];
    expect(pickDistractors(answer, pool, 3)).toEqual(['yyyyy']);
  });
});
