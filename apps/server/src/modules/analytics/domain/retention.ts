export type RetentionBucketKey = '1d' | '3d' | '1w' | '1m' | '1m+';

export interface RetentionBucket {
  bucket: RetentionBucketKey;
  total: number;
  remembered: number;
  /** remembered / total, or null when the bucket has no reviews. */
  rate: number | null;
}

/** Upper bound (inclusive, in days) of each bucket, in display order. */
const bucketBounds: [RetentionBucketKey, number][] = [
  ['1d', 1],
  ['3d', 3],
  ['1w', 7],
  ['1m', 29],
  ['1m+', Infinity],
];

export function retentionBucketFor(intervalDays: number): RetentionBucketKey {
  return bucketBounds.find(([, max]) => intervalDays <= max)![0];
}

/**
 * Groups reviews by how long the card had been away (`intervalBefore`)
 * and reports how many were remembered. A review counts as remembered
 * for any rating except AGAIN — SM-2 treats HARD as a (difficult) pass.
 * First reviews (`intervalBefore` 0) aren't recall after a gap and are
 * skipped. `count` lets callers pass pre-aggregated rows (default 1).
 */
export function bucketRetention(
  reviews: { intervalBefore: number; rating: string; count?: number }[],
): RetentionBucket[] {
  const buckets = new Map<RetentionBucketKey, RetentionBucket>(
    bucketBounds.map(([bucket]) => [
      bucket,
      { bucket, total: 0, remembered: 0, rate: null },
    ]),
  );
  for (const review of reviews) {
    if (review.intervalBefore <= 0) continue;
    const bucket = buckets.get(retentionBucketFor(review.intervalBefore))!;
    const n = review.count ?? 1;
    bucket.total += n;
    if (review.rating !== 'AGAIN') bucket.remembered += n;
  }
  return [...buckets.values()].map((b) => ({
    ...b,
    rate: b.total > 0 ? b.remembered / b.total : null,
  }));
}
