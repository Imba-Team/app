import type { RetentionBucket } from '@/lib/api';
import { cn } from '@/lib/utils';

import { formatPercent, pluralize } from './progressFormat';

const bucketLabels: Record<RetentionBucket['bucket'], string> = {
  '1d': 'After 1 day',
  '3d': 'After 2–3 days',
  '1w': 'After 4–7 days',
  '1m': 'After 1–4 weeks',
  '1m+': 'After a month+',
};

/** Below this many reviews a rate is too noisy to read much into. */
const minReviews = 5;

/**
 * How often cards were remembered when they came back after a gap.
 * Plain bars rather than a chart: five labelled rows read better.
 */
export function RetentionChart({ retention }: { retention: RetentionBucket[] }) {
  const hasAny = retention.some((b) => b.total > 0);

  if (!hasAny) {
    return (
      <div className="flex h-56 items-center justify-center text-center">
        <p className="max-w-xs text-sm text-neutral-500">
          This fills in as cards come back for review. Keep reviewing and check back in a few
          days.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {retention.map((b) => {
        const isThin = b.total < minReviews;
        return (
          <li key={b.bucket} className={cn('flex flex-col gap-1.5', isThin && 'opacity-60')}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-neutral-700">{bucketLabels[b.bucket]}</span>
              <span className="tabular-nums text-neutral-500">
                <strong className="font-semibold text-neutral-900">{formatPercent(b.rate)}</strong>
                {' · '}
                {b.total === 0
                  ? 'no reviews yet'
                  : isThin
                    ? `${pluralize(b.total, 'review')}, not enough yet`
                    : pluralize(b.total, 'review')}
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-neutral-100"
              role="meter"
              aria-label={bucketLabels[b.bucket]}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={b.rate == null ? 0 : Math.round(b.rate * 100)}
            >
              <div
                className="h-full rounded-full bg-brand-400"
                style={{ width: `${(b.rate ?? 0) * 100}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
