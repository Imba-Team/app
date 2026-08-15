'use client';

/**
 * Test-history page: paginated list of the caller's TestAttempts
 * for this module. Each row shows the score, correctness breakdown,
 * duration, and a "Review" link that deep-links to the Test client
 * with `?review=<attemptId>` — which useTestAttempt already knows
 * how to hydrate.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useModule } from '@/lib/hooks/useModules';
import { useTestHistory } from '@/lib/hooks/useTestHistory';
import type { TestHistoryItem } from '@/lib/api';

const PAGE_SIZE = 20;

export default function TestHistoryPageClient({
  moduleId,
}: {
  moduleId: string;
}) {
  const router = useRouter();
  const { data: moduleData } = useModule(moduleId);
  const [page, setPage] = useState(0);
  const {
    data,
    isLoading,
    isFetching,
    error,
  } = useTestHistory({
    studySetId: moduleId,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-6 py-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/modules/${moduleId}`}>
              <ArrowLeft className="h-4 w-4" />
              Back to module
            </Link>
          </Button>
          {moduleData?.data && (
            <h1 className="mt-2 truncate text-2xl font-bold text-neutral-900 md:text-3xl">
              {moduleData.data.title}
            </h1>
          )}
          <p className="mt-1 text-sm text-neutral-500">Test history</p>
        </div>
        <Button onClick={() => router.push(`/modules/${moduleId}/test`)}>
          Take a new test
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-rose-600" />
              <p className="font-semibold text-neutral-900">
                Couldn&apos;t load history
              </p>
            </div>
            <p className="text-sm text-neutral-600">{error.message}</p>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState moduleId={moduleId} />
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item) => (
              <AttemptRow
                key={item.attemptId}
                item={item}
                moduleId={moduleId}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || isFetching}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <p className="text-xs text-neutral-500">
                Page {page + 1} of {totalPages}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((p) => Math.min(totalPages - 1, p + 1))
                }
                disabled={page >= totalPages - 1 || isFetching}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function AttemptRow({
  item,
  moduleId,
}: {
  item: TestHistoryItem;
  moduleId: string;
}) {
  const scoreTone =
    item.status !== 'COMPLETED'
      ? 'neutral'
      : item.score >= 80
        ? 'emerald'
        : item.score >= 60
          ? 'amber'
          : 'rose';
  const toneClasses = {
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    rose: 'bg-rose-50 text-rose-800 border-rose-200',
    neutral: 'bg-neutral-50 text-neutral-600 border-neutral-200',
  }[scoreTone];
  const statusBadge =
    item.status === 'COMPLETED'
      ? null
      : item.status === 'IN_PROGRESS'
        ? { label: 'In progress', cls: 'bg-brand-300/20 text-neutral-800' }
        : { label: 'Abandoned', cls: 'bg-neutral-100 text-neutral-600' };

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex size-16 flex-col items-center justify-center rounded-2xl border font-bold',
              toneClasses,
            )}
          >
            {item.status === 'COMPLETED' ? (
              <>
                <span className="text-lg leading-none">
                  {Math.round(item.score)}%
                </span>
                <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide opacity-75">
                  score
                </span>
              </>
            ) : (
              <span className="text-xs font-medium">—</span>
            )}
          </div>
          <div className="space-y-0.5">
            <p className="font-semibold text-neutral-900">
              {formatDate(item.createdAt)}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
              {statusBadge && (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 font-medium',
                    statusBadge.cls,
                  )}
                >
                  {statusBadge.label}
                </span>
              )}
              {item.status === 'COMPLETED' && (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  {item.correctCount} correct
                </span>
              )}
              {item.status === 'COMPLETED' && (
                <span className="inline-flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-rose-600" />
                  {item.incorrectCount} wrong
                </span>
              )}
              {item.durationSeconds != null && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(item.durationSeconds)}
                </span>
              )}
            </div>
          </div>
        </div>
        {item.status === 'COMPLETED' && (
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/modules/${moduleId}/test?review=${item.attemptId}`}
            >
              Review
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ moduleId }: { moduleId: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-lg font-semibold text-neutral-900">
          No tests yet
        </p>
        <p className="max-w-md text-sm text-neutral-600">
          Take your first test on this module — results show up here so you can
          review your answers.
        </p>
        <Button asChild>
          <Link href={`/modules/${moduleId}/test`}>Start a test</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatDuration(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}
