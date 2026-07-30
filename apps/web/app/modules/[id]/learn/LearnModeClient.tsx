'use client';

/**
 * Learn Mode — TDD Sprint 6.
 *
 * Adaptive learning: the server hands the client 7–10 non-mastered
 * cards at a time and picks per-card between LEARN_MC (multiple-choice
 * recognition) and LEARN_WRITTEN (typed recall) based on the learner's
 * current weighted-streak on that card. The frontend renders whichever
 * prompt the server sent, submits the answer through the appropriate
 * endpoint, and lets the server run the mastery engine.
 *
 * Answers:
 *  - LEARN_MC     → POST /sessions/:id/answer (outcome = correct?)
 *  - LEARN_WRITTEN → POST /sessions/:id/answer-written
 *
 * When the current batch is spent, we fetch the next batch. When the
 * server signals `hasMoreCards === false`, we show the completion
 * screen and let the learner call POST /sessions/:id/complete.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Lightbulb,
  Loader2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import SessionResults, {
  SessionResultsError,
  SessionResultsLoading,
} from '../_components/SessionResults';
import { useModule } from '@/lib/hooks/useModules';
import { useTerms } from '@/lib/hooks/useTerms';
import {
  useLearnSession,
  type LearnCardResult,
} from '@/lib/hooks/useLearnSession';
import type { LearnBatchCard } from '@/lib/api';

// Hold the correctness feedback on-screen this long before auto-
// advancing. Long enough for the learner to internalise the correct
// answer, short enough that the pace stays brisk.
const FEEDBACK_HOLD_MS = 1400;

const KBD_CLASS =
  'font-mono rounded border border-black/10 bg-white px-1 text-neutral-700';

const WRITTEN_FIELD_CLASS =
  'w-full min-h-28 resize-y rounded-2xl border border-black/10 bg-white px-4 py-3 text-base leading-relaxed text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors hover:border-black/20 focus-visible:border-brand-400 focus-visible:ring-4 focus-visible:ring-brand-300/40 disabled:bg-neutral-50';

// After a session with no non-mastered cards the server returns an
// empty batch on the first call; render an appropriate empty state
// instead of a completion screen.
type EmptyReason = 'no-terms' | 'all-mastered' | null;

export default function LearnModeClient({ moduleId }: { moduleId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeSessionId = searchParams.get('sessionId') ?? undefined;
  const { data: moduleData, isLoading: moduleLoading } = useModule(moduleId);
  const { data: allTerms = [], isLoading: termsLoading } = useTerms(moduleId);
  const enabled = !moduleLoading && !termsLoading && allTerms.length > 0;

  const {
    sessionId,
    status,
    error,
    summary,
    currentCard,
    latestProgress,
    answers,
    lastResult,
    hasMoreCards,
    submitMc,
    submitWritten,
    advance,
    finish,
    retry,
  } = useLearnSession({ moduleId, enabled, resumeSessionId });

  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (status !== 'showing-feedback') return;
    holdRef.current = setTimeout(() => {
      void advance();
    }, FEEDBACK_HOLD_MS);
    return () => {
      if (holdRef.current) clearTimeout(holdRef.current);
    };
  }, [status, advance]);

  const autoFinishedRef = useRef(false);
  useEffect(() => {
    const sessionDone =
      sessionId !== null &&
      !hasMoreCards &&
      currentCard === null &&
      status === 'active' &&
      answers.length > 0;
    if (sessionDone && !autoFinishedRef.current) {
      autoFinishedRef.current = true;
      void finish();
    }
  }, [sessionId, hasMoreCards, currentCard, status, answers.length, finish]);

  const [hintUsedByCard, setHintUsedByCard] = useState<Record<string, boolean>>(
    {},
  );
  const markHintUsed = useCallback(
    (cardId: string) => {
      setHintUsedByCard((prev) =>
        prev[cardId] ? prev : { ...prev, [cardId]: true },
      );
    },
    [setHintUsedByCard],
  );

  // ============================================
  // states: loading / empty / error / complete / summary / active
  // ============================================

  if (moduleLoading || termsLoading || status === 'starting') {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-3 px-6">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  if (allTerms.length === 0) {
    return <EmptyPanel moduleId={moduleId} reason="no-terms" />;
  }

  if (status === 'error' && error && !summary && answers.length === 0) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-6 py-12">
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-rose-600" />
              <p className="text-lg font-semibold text-neutral-900">
                Couldn&apos;t start Learn Mode
              </p>
            </div>
            <p className="text-sm text-neutral-600">{error}</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={retry}>Try again</Button>
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

  if (summary) {
    return (
      <SessionResults
        summary={summary}
        answers={answers}
        moduleId={moduleId}
        modeRoute="learn"
        latestProgress={latestProgress}
      />
    );
  }

  const noCardsToStudy =
    sessionId !== null &&
    !hasMoreCards &&
    currentCard === null &&
    answers.length === 0 &&
    status !== 'loading-batch';
  if (noCardsToStudy) {
    return <EmptyPanel moduleId={moduleId} reason="all-mastered" />;
  }

  const isSessionEnd =
    sessionId !== null &&
    !hasMoreCards &&
    currentCard === null &&
    answers.length > 0;
  if (isSessionEnd) {
    if (status === 'error' && error) {
      return (
        <SessionResultsError
          error={error}
          onRetry={finish}
          moduleId={moduleId}
        />
      );
    }
    return <SessionResultsLoading />;
  }

  if (!currentCard || status === 'loading-batch') {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-3 px-6">
        <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
        <p className="text-sm text-neutral-500">Loading next batch…</p>
      </main>
    );
  }

  const hintUsed = !!hintUsedByCard[currentCard.cardId];
  const total = latestProgress?.totalCards;
  const mastered = latestProgress?.masteredCount;

  // ============================================
  // main render
  // ============================================

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-6 py-8 sm:px-8">
      {/* Header */}
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
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-medium text-neutral-700">
            Answered {answers.length}
          </p>
          {mastered !== undefined && total !== undefined && (
            <p className="text-xs text-neutral-500">
              {mastered}/{total} mastered
            </p>
          )}
        </div>
      </div>

      {/* Mastery progress */}
      {mastered !== undefined && total !== undefined && total > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${(mastered / total) * 100}%` }}
          />
        </div>
      )}

      {/* Prompt */}
      <PromptCard
        card={currentCard}
        hintUsed={hintUsed}
        onHint={() => markHintUsed(currentCard.cardId)}
        lastResult={lastResult}
        isSubmitting={status === 'showing-feedback'}
        onSubmitMc={(selectedChoiceIndex) =>
          submitMc({ selectedChoiceIndex, hintUsed })
        }
        onSubmitWritten={(userAnswer) =>
          submitWritten({ userAnswer, hintUsed })
        }
      />
    </main>
  );
}

// ============================================================
// Prompt card — dispatches on promptType
// ============================================================

function PromptCard({
  card,
  hintUsed,
  onHint,
  lastResult,
  isSubmitting,
  onSubmitMc,
  onSubmitWritten,
}: {
  card: LearnBatchCard;
  hintUsed: boolean;
  onHint: () => void;
  lastResult: LearnCardResult | null;
  isSubmitting: boolean;
  onSubmitMc: (selectedChoiceIndex: number) => void;
  onSubmitWritten: (userAnswer: string) => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-6">
        {/* Prompt term + hint control */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              {card.promptType === 'LEARN_MC'
                ? 'Choose the definition'
                : 'Type the definition'}
            </p>
            <p className="wrap-break-word text-2xl font-semibold text-neutral-900 sm:text-3xl">
              {card.term}
            </p>
            {card.hint && hintUsed && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {card.hint}
              </p>
            )}
          </div>
          {card.hint && (
            <button
              type="button"
              onClick={onHint}
              disabled={isSubmitting || hintUsed}
              aria-label="Reveal hint"
              title={hintUsed ? 'Hint used (halves credit)' : 'Reveal hint'}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
                hintUsed
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-black/10 bg-white text-neutral-700 hover:bg-black/5',
                (isSubmitting || hintUsed) && 'cursor-default',
              )}
            >
              <Lightbulb className="h-3.5 w-3.5" />
              {hintUsed ? 'Hint used' : 'Hint'}
            </button>
          )}
        </div>

        {card.promptType === 'LEARN_MC' ? (
          <McChoices
            card={card}
            lastResult={lastResult?.kind === 'mc' ? lastResult : null}
            disabled={isSubmitting}
            onSubmit={onSubmitMc}
          />
        ) : (
          <WrittenPrompt
            key={card.cardId}
            lastResult={lastResult?.kind === 'written' ? lastResult : null}
            disabled={isSubmitting}
            onSubmit={onSubmitWritten}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Multiple-choice
// ============================================================

function McChoices({
  card,
  lastResult,
  disabled,
  onSubmit,
}: {
  card: LearnBatchCard;
  lastResult: (LearnCardResult & { kind: 'mc' }) | null;
  disabled: boolean;
  onSubmit: (selectedChoiceIndex: number) => void;
}) {
  const choices = card.choices ?? [];
  const showingFeedback = lastResult !== null;

  const choiceState = (idx: number): 'idle' | 'correct' | 'wrong' | 'muted' => {
    if (!showingFeedback) return 'idle';
    if (idx === lastResult.correctChoiceIndex) return 'correct';
    if (idx === lastResult.selectedChoiceIndex && !lastResult.correct)
      return 'wrong';
    return 'muted';
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {choices.map((choice, idx) => {
        const state = choiceState(idx);
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onSubmit(idx)}
            disabled={disabled}
            className={cn(
              'rounded-2xl border p-4 text-left transition-all',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300/40',
              state === 'idle' &&
                'border-black/10 bg-white hover:border-brand-400 hover:bg-brand-300/10',
              state === 'correct' && 'border-emerald-400 bg-emerald-50',
              state === 'wrong' && 'border-rose-400 bg-rose-50',
              state === 'muted' && 'border-black/10 bg-white opacity-50',
              disabled && 'cursor-default',
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs',
                  state === 'correct' && 'bg-emerald-100 text-emerald-700',
                  state === 'wrong' && 'bg-rose-100 text-rose-700',
                  state === 'idle' && 'bg-neutral-100 text-neutral-600',
                  state === 'muted' && 'bg-neutral-100 text-neutral-400',
                )}
              >
                {idx + 1}
              </span>
              <span className="flex-1 text-base leading-relaxed text-neutral-800">
                {choice}
              </span>
              {state === 'correct' && (
                <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-emerald-600" />
              )}
              {state === 'wrong' && (
                <XCircle className="ml-auto h-5 w-5 shrink-0 text-rose-600" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// Written prompt
// ============================================================

function WrittenPrompt({
  lastResult,
  disabled,
  onSubmit,
}: {
  lastResult: (LearnCardResult & { kind: 'written' }) | null;
  disabled: boolean;
  onSubmit: (userAnswer: string) => void;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Autofocus the input when the card mounts.
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const handleSubmit = () => {
    if (disabled) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  if (lastResult) {
    return <WrittenFeedback result={lastResult} />;
  }

  return (
    <div className="space-y-3">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="Type your answer…"
        rows={3}
        disabled={disabled}
        className={WRITTEN_FIELD_CLASS}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-neutral-500">
          <kbd className={KBD_CLASS}>Enter</kbd> submit ·{' '}
          <kbd className={KBD_CLASS}>Shift+Enter</kbd> newline
        </span>
        <Button onClick={handleSubmit} disabled={disabled || !value.trim()}>
          Submit
        </Button>
      </div>
    </div>
  );
}

function WrittenFeedback({
  result,
}: {
  result: LearnCardResult & { kind: 'written' };
}) {
  const isTypo = result.matchType === 'TYPO_ACCEPTED';
  const isExact = result.matchType === 'EXACT';
  const isWrong = result.matchType === 'WRONG';
  const pct = Math.round(result.similarity * 100);

  return (
    <div
      className={cn(
        'space-y-2 rounded-2xl border p-4',
        result.correct
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-rose-200 bg-rose-50',
      )}
    >
      <div className="flex items-center gap-2">
        {result.correct ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <XCircle className="h-5 w-5 shrink-0 text-rose-600" />
        )}
        <p className="font-semibold text-neutral-900">
          {isExact && 'Perfect.'}
          {isTypo && 'Close enough — counted as correct.'}
          {isWrong && 'Not quite.'}
        </p>
      </div>

      {isTypo && (
        <p className="text-sm text-neutral-700">
          You typed <InlineChip tone="amber">{result.normalizedInput}</InlineChip> — expected{' '}
          <InlineChip tone="emerald">{result.correctAnswer}</InlineChip> (
          {result.editDistance} character{result.editDistance === 1 ? '' : 's'} off).
        </p>
      )}

      {isWrong && (
        <div className="space-y-1 text-sm text-neutral-700">
          <p>
            You typed <InlineChip tone="rose">{result.normalizedInput}</InlineChip>
          </p>
          <p>
            Correct answer:{' '}
            <InlineChip tone="emerald">{result.correctAnswer}</InlineChip>
          </p>
          <p className="mt-1 text-xs text-neutral-500">Similarity {pct}%.</p>
        </div>
      )}
    </div>
  );
}

function InlineChip({
  tone,
  children,
}: {
  tone: 'amber' | 'emerald' | 'rose';
  children: React.ReactNode;
}) {
  const cls = {
    amber: 'bg-amber-100/70 text-amber-800',
    emerald: 'bg-emerald-100/70 text-emerald-800',
    rose: 'bg-rose-100/70 text-rose-800',
  }[tone];
  return (
    <span
      className={cn(
        'rounded-md px-1.5 py-0.5 font-mono text-[13px]',
        cls,
      )}
    >
      {children}
    </span>
  );
}

// ============================================================
// Empty / finish / summary panels
// ============================================================

function EmptyPanel({
  moduleId,
  reason,
}: {
  moduleId: string;
  reason: NonNullable<EmptyReason>;
}) {
  const router = useRouter();
  const noTerms = reason === 'no-terms';
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-6 py-12">
      <Card>
        <CardContent className="space-y-3">
          <p className="text-lg font-semibold text-neutral-900">
            {noTerms ? 'No terms to study' : "You've mastered every card"}
          </p>
          <p className="text-sm text-neutral-600">
            {noTerms
              ? "This module doesn't have any flashcards yet. Add some terms first."
              : "There's nothing left to learn in this module. Reset your progress to run through it again, or try another mode."}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={() => router.push(`/modules/${moduleId}`)}>
              Back to module
            </Button>
            {!noTerms && (
              <Button
                variant="outline"
                onClick={() => router.push(`/modules/${moduleId}/flashcards`)}
              >
                Study with Flashcards
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
