'use client';

/**
 * Study session history for one module.
 *
 * Renders paginated SessionHistoryItemDto rows from GET /sessions with
 * ?studySetId= — see TDD §11.3. Each row shows mode, timestamp,
 * duration, correct/incorrect counts, and computed accuracy. In-progress
 * sessions (no `completedAt`) are called out separately so learners
 * don't confuse an abandoned session with a completed one.
 */

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Play,
  Target,
  XCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useModule } from '@/lib/hooks/useModules';
import { useSessionHistory } from '@/lib/hooks/useSessionHistory';
import type { SessionHistoryItem } from '@/lib/api';

const PAGE_SIZE = 20;

const MODE_LABEL: Record<SessionHistoryItem['mode'], string> = {
  FLASHCARD: 'Flashcards',
  LEARN: 'Learn',
  WRITE: 'Write',
  SPELL: 'Spell',
  TEST: 'Test',
  MATCH: 'Match',
  AI_FILL_BLANK: 'Fill in the blank',
  AI_GUESS_WORD: 'Guess the word',
};

// Modes that have a built UI today. Others render "In progress" without
// a resume button — we don't want to link into a route that doesn't exist.
const RESUMABLE_MODE_ROUTE: Partial<
  Record<SessionHistoryItem['mode'], string>
> = {
  FLASHCARD: 'flashcards',
  LEARN: 'learn',
};

const MODE_BADGE: Record<SessionHistoryItem['mode'], string> = {
  FLASHCARD: 'bg-brand-500/10 text-brand-500',
  LEARN: 'bg-emerald-50 text-emerald-700',
  WRITE: 'bg-amber-50 text-amber-700',
  SPELL: 'bg-cyan-50 text-cyan-700',
  TEST: 'bg-rose-50 text-rose-700',
  MATCH: 'bg-fuchsia-50 text-fuchsia-700',
  AI_FILL_BLANK: 'bg-purple-50 text-purple-700',
  AI_GUESS_WORD: 'bg-purple-50 text-purple-700',
};

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 1) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0)
    return `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (diffDays === 1)
    return `Yesterday, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (diffDays < 7)
    return d.toLocaleDateString([], {
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function SessionsPageClient({ moduleId }: { moduleId: string }) {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const { data: moduleData } = useModule(moduleId);
  const { data, isLoading, isError } = useSessionHistory({
    studySetId: moduleId,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const totals = useMemo(() => {
    if (!data) return null;
    // Roll up the visible page. TDD notes analytics live in ClickHouse,
    // so an all-time aggregate belongs in a future dashboard endpoint;
    // for now, summarise the page the user is looking at.
    const summed = data.items.reduce(
      (acc, s) => {
        acc.correct += s.correctAnswers;
        acc.incorrect += s.incorrectAnswers;
        acc.duration += s.durationSeconds;
        return acc;
      },
      { correct: 0, incorrect: 0, duration: 0 },
    );
    const attempts = summed.correct + summed.incorrect;
    return {
      ...summed,
      accuracy: attempts === 0 ? 0 : summed.correct / attempts,
    };
  }, [data]);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-6 py-8 sm:px-8">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/modules/${moduleId}`}>
          <ArrowLeft className="h-4 w-4" />
          Back to module
        </Link>
      </Button>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">
            Session history
          </h1>
          {moduleData?.data && (
            <p className="mt-1 text-neutral-500">{moduleData.data.title}</p>
          )}
        </div>
        {totals && data && data.items.length > 0 && (
          <div className="text-right text-sm text-neutral-500">
            <p>
              <span className="font-semibold text-neutral-800">
                {data.total}
              </span>{' '}
              total sessions
            </p>
            <p>
              {Math.round((totals.accuracy ?? 0) * 100)}% accuracy on this page
            </p>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-3xl" />
          ))}
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="flex flex-col items-start gap-3">
            <p className="font-semibold text-rose-600">
              Couldn&apos;t load session history
            </p>
            <p className="text-sm text-neutral-600">
              Something went wrong on our end. Try refreshing the page.
            </p>
            <Button variant="outline" onClick={() => router.refresh()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {data && data.items.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-start gap-4">
            <p className="text-lg font-semibold text-neutral-900">
              No sessions yet
            </p>
            <p className="text-sm text-neutral-600">
              Study this module with any mode to start building your history.
              Sessions record what you studied, how long you studied, and how
              many cards you got right.
            </p>
            <Button
              onClick={() => router.push(`/modules/${moduleId}/flashcards`)}
            >
              Start with Flashcards
            </Button>
          </CardContent>
        </Card>
      )}

      {data && data.items.length > 0 && (
        <>
          <ul className="space-y-3">
            {data.items.map((s) => (
              <li key={s.sessionId}>
                <SessionRow session={s} moduleId={moduleId} />
              </li>
            ))}
          </ul>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-neutral-500">
                Page {data.page} of {data.totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={data.page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={data.page >= data.totalPages}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function SessionRow({
  session,
  moduleId,
}: {
  session: SessionHistoryItem;
  moduleId: string;
}) {
  const label = MODE_LABEL[session.mode] ?? session.mode;
  const badge =
    MODE_BADGE[session.mode] ?? 'bg-neutral-100 text-neutral-700';
  const accuracyPct = Math.round((session.accuracy ?? 0) * 100);
  const isInProgress = !session.completedAt;
  const totalAnswers = session.correctAnswers + session.incorrectAnswers;
  const resumeRoute = isInProgress
    ? RESUMABLE_MODE_ROUTE[session.mode]
    : undefined;

  return (
    <Card>
      <CardContent className="space-y-4 px-5 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
              badge,
            )}
          >
            <BookOpen className="h-3 w-3" />
            {label}
          </span>
          {isInProgress ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                <span className="size-1.5 rounded-full bg-amber-500" />
                In progress
              </span>
              <span className="text-xs text-neutral-500">
                Started {formatWhen(session.startedAt)}
              </span>
              {resumeRoute && (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                >
                  <Link
                    href={`/modules/${moduleId}/${resumeRoute}?sessionId=${session.sessionId}`}
                  >
                    <Play className="h-3.5 w-3.5" />
                    Resume
                  </Link>
                </Button>
              )}
            </>
          ) : (
            <span className="text-xs text-neutral-500">
              {formatWhen(session.completedAt)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat
            icon={<Target className="h-3.5 w-3.5 text-neutral-500" />}
            label="Accuracy"
            value={totalAnswers === 0 ? '—' : `${accuracyPct}%`}
          />
          <Stat
            icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
            label="Correct"
            value={session.correctAnswers.toString()}
          />
          <Stat
            icon={<XCircle className="h-3.5 w-3.5 text-rose-600" />}
            label="Incorrect"
            value={session.incorrectAnswers.toString()}
          />
          <Stat
            icon={<Clock className="h-3.5 w-3.5 text-neutral-500" />}
            label="Duration"
            value={formatDuration(session.durationSeconds)}
          />
        </div>

        {!isInProgress && (
          <p className="text-xs text-neutral-400">
            Started {formatWhen(session.startedAt)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
        {icon}
        {label}
      </div>
      <div className="font-semibold text-neutral-900">{value}</div>
    </div>
  );
}
