'use client';

/**
 * Shared results screen for study modes.
 *
 * Both Flashcards and Learn mode used to render two panels: an
 * intermediate "You went through every card / End of session" screen
 * with a Finish button, and then a separate summary once the server
 * ack'd `POST /sessions/:id/complete`. That extra hop was cognitive
 * dead weight — the learner had already finished when the deck ran
 * out. This component is the single detailed results page both modes
 * render once `finish()` resolves.
 *
 * Feed it the session summary from the server plus the running list
 * of per-card answers so we can compute session-scoped stats
 * (newly-mastered count, hint-used count) that aren't on the summary
 * DTO itself.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  History,
  Lightbulb,
  Loader2,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { SessionSummary } from '@/lib/api';

interface SessionAnswerLike {
  graduated: boolean;
  hintUsed: boolean;
}

interface SessionResultsProps {
  summary: SessionSummary;
  answers: SessionAnswerLike[];
  moduleId: string;
  /**
   * The route segment for "Study again" — 'flashcards' or 'learn'.
   * Used to build the restart link.
   */
  modeRoute: 'flashcards' | 'learn';
  /** Optional mastery rollup from the last per-card response. */
  latestProgress?: {
    totalCards: number;
    masteredCount: number;
  } | null;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export default function SessionResults({
  summary,
  answers,
  moduleId,
  modeRoute,
  latestProgress,
}: SessionResultsProps) {
  const router = useRouter();
  const accuracyPct = Math.round((summary.accuracy ?? 0) * 100);
  const newlyMastered = answers.filter((a) => a.graduated).length;
  const hintUsedCount = answers.filter((a) => a.hintUsed).length;

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-6 py-10 sm:py-16">
      {/* Header */}
      <div className="text-center">
        <div className="mb-3 inline-flex items-center justify-center rounded-full bg-brand-500/10 p-3">
          <Trophy className="h-7 w-7 text-brand-500" />
        </div>
        <h1 className="text-3xl font-bold text-neutral-900">
          Session complete
        </h1>
        <p className="mt-1 text-neutral-500">
          {summary.mode === 'FLASHCARD' ? 'Flashcards' : 'Learn'} ·{' '}
          {formatDuration(summary.durationSeconds)}
        </p>
      </div>

      {/* Headline accuracy card */}
      <Card>
        <CardContent className="grid grid-cols-3 items-center gap-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">
              {summary.correctAnswers}
            </div>
            <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              Correct
            </div>
          </div>
          <div className="border-x border-black/5 text-center">
            <div className="text-4xl font-extrabold text-neutral-900">
              {accuracyPct}
              <span className="text-xl text-neutral-400">%</span>
            </div>
            <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              Accuracy
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-rose-600">
              {summary.incorrectAnswers}
            </div>
            <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              Incorrect
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detail grid */}
      <Card>
        <CardContent className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            This session
          </p>
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Stat
              icon={<Target className="h-3.5 w-3.5 text-neutral-500" />}
              label="Cards studied"
              value={summary.cardsStudied.toString()}
            />
            <Stat
              icon={<Clock className="h-3.5 w-3.5 text-neutral-500" />}
              label="Duration"
              value={formatDuration(summary.durationSeconds)}
            />
            <Stat
              icon={<Sparkles className="h-3.5 w-3.5 text-brand-500" />}
              label="Newly mastered"
              value={newlyMastered.toString()}
              accent={newlyMastered > 0 ? 'positive' : undefined}
            />
            <Stat
              icon={<Lightbulb className="h-3.5 w-3.5 text-neutral-500" />}
              label="Hint used"
              value={`${hintUsedCount} ${hintUsedCount === 1 ? 'card' : 'cards'}`}
            />
          </div>
        </CardContent>
      </Card>

      {/* SRS graduation callout — only render when the session actually
          graduated cards. Each graduation writes an SrsCard row that
          surfaces on `/srs` the next day. */}
      {newlyMastered > 0 && (
        <Card className="bg-emerald-50/60">
          <CardContent className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-sm">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              <span className="text-neutral-800">
                <span className="font-semibold">{newlyMastered}</span> card
                {newlyMastered === 1 ? '' : 's'} graduated to Spaced Review.
              </span>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/srs">See queue →</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Overall mastery — only render if we have the rollup */}
      {latestProgress && (
        <Card>
          <CardContent className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Overall mastery
            </p>
            <MasteryBar
              mastered={latestProgress.masteredCount}
              total={latestProgress.totalCards}
            />
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button
          onClick={() => router.push(`/modules/${moduleId}/${modeRoute}`)}
          className="flex-1 sm:flex-none"
        >
          <RotateCcw className="h-4 w-4" />
          Study again
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push(`/modules/${moduleId}`)}
          className="flex-1 sm:flex-none"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to module
        </Button>
        <Button asChild variant="ghost" size="sm" className="ml-auto">
          <Link href={`/modules/${moduleId}/sessions`}>
            <History className="h-3.5 w-3.5" />
            Session history
          </Link>
        </Button>
      </div>
    </main>
  );
}

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: 'positive';
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="flex items-center gap-2 text-neutral-500">
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={
          accent === 'positive'
            ? 'inline-flex items-center gap-1 font-semibold text-brand-500'
            : 'font-semibold text-neutral-900'
        }
      >
        {accent === 'positive' && <CheckCircle2 className="h-3.5 w-3.5" />}
        {value}
      </div>
    </div>
  );
}

function MasteryBar({ mastered, total }: { mastered: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((mastered / total) * 100);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-600">
          {mastered} of {total} mastered
        </span>
        <span className="font-semibold text-neutral-900">{pct}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/5">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// A subtle marker export for pages that want to render an in-flight
// "wrapping up" loader while `finish()` resolves.
export function SessionResultsLoading() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-3 px-6 py-12">
      <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      <p className="text-sm text-neutral-500">Wrapping up your session…</p>
    </main>
  );
}

/**
 * Small "we couldn't save the summary" fallback for the case where
 * finish() throws. Gives the learner a retry path so they don't lose
 * the sense of closure.
 */
export function SessionResultsError({
  error,
  onRetry,
  moduleId,
}: {
  error: string;
  onRetry: () => void;
  moduleId: string;
}) {
  const router = useRouter();
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-6 py-12">
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-rose-600" />
            <p className="text-lg font-semibold text-neutral-900">
              Couldn&apos;t save your session
            </p>
          </div>
          <p className="text-sm text-neutral-600">{error}</p>
          <p className="text-xs text-neutral-500">
            Your answers were already recorded card-by-card — this was just
            the summary write. It&apos;s safe to retry.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onRetry}>Try again</Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/modules/${moduleId}`)}
            >
              Back to module
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
