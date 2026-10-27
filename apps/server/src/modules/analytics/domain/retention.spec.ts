import { bucketRetention, retentionBucketFor } from './retention';

describe('retention', () => {
  it('puts intervals into the right buckets at the edges', () => {
    expect(retentionBucketFor(1)).toBe('1d');
    expect(retentionBucketFor(2)).toBe('3d');
    expect(retentionBucketFor(3)).toBe('3d');
    expect(retentionBucketFor(4)).toBe('1w');
    expect(retentionBucketFor(7)).toBe('1w');
    expect(retentionBucketFor(8)).toBe('1m');
    expect(retentionBucketFor(29)).toBe('1m');
    expect(retentionBucketFor(30)).toBe('1m+');
    expect(retentionBucketFor(400)).toBe('1m+');
  });

  it('counts everything but AGAIN as remembered and skips first reviews', () => {
    const result = bucketRetention([
      { intervalBefore: 0, rating: 'GOOD' },
      { intervalBefore: 1, rating: 'GOOD' },
      { intervalBefore: 1, rating: 'HARD' },
      { intervalBefore: 1, rating: 'AGAIN' },
      { intervalBefore: 1, rating: 'EASY', count: 5 },
      { intervalBefore: 40, rating: 'AGAIN', count: 2 },
    ]);
    expect(result).toEqual([
      { bucket: '1d', total: 8, remembered: 7, rate: 7 / 8 },
      { bucket: '3d', total: 0, remembered: 0, rate: null },
      { bucket: '1w', total: 0, remembered: 0, rate: null },
      { bucket: '1m', total: 0, remembered: 0, rate: null },
      { bucket: '1m+', total: 2, remembered: 0, rate: 0 },
    ]);
  });
});
