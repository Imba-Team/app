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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  Loader2,
  RotateCw,
  SkipForward,
  SlidersHorizontal,
  Star,
  ThumbsUp,
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
import { useTerms, useToggleTermStar } from '@/lib/hooks/useTerms';
import { useLearnSession, type LearnCardResult } from '@/lib/hooks/useLearnSession';
import type { LearnBatchCard, LearnResumeState } from '@/lib/api';
import { abandonSession } from '@/lib/api';
import {
  useInflightLearnSession,
  useInvalidateInflightLearnSession,
} from '@/lib/hooks/useInflightLearnSession';
import { useSetPreferences, useUpdateSetPreferences } from '@/lib/hooks/useSetPreferences';
import { ResumeSessionDialog } from '@/components/ResumeSessionDialog';
import { StudyPreferencesDialog } from '@/components/StudyPreferencesDialog';

// Fallback hold before auto-advancing past a correct answer, used
// only when the learner has no saved per-set preference. Wrong
// answers never auto-advance; the learner clicks Next.
const feedbackHoldMs = 1400;

const kbdClass = 'font-mono rounded border border-black/10 bg-white px-1 text-neutral-700';

const writtenFieldClass =
  'w-full min-h-28 resize-y rounded-2xl border border-black/10 bg-white px-4 py-3 text-base leading-relaxed text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors hover:border-black/20 focus-visible:border-brand-400 focus-visible:ring-4 focus-visible:ring-brand-300/40 disabled:bg-neutral-50';

// After a session with no non-mastered cards the server returns an
// empty batch on the first call; render an appropriate empty state
// instead of a completion screen.
type EmptyReason = 'no-terms' | 'all-mastered' | 'no-starred' | null;

export default function LearnModeClient({ moduleId }: { moduleId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSessionId = searchParams.get('sessionId') ?? undefined;
  const dueFirst = searchParams.get('dueFirst') === '1';
  const { data: moduleData, isLoading: moduleLoading } = useModule(moduleId);
  const { data: allTerms = [], isLoading: termsLoading } = useTerms(moduleId);
  const { data: preferences } = useSetPreferences(moduleId);
  const updatePreferences = useUpdateSetPreferences(moduleId);
  const toggleStar = useToggleTermStar(moduleId);

  // Map cardId → term for the round-up per-card list. The terms query
  // is cheap (already loaded above for the batch flow) and re-renders
  // when a star toggle mutates the cache.
  const termsByCardId = useMemo(() => new Map(allTerms.map((t) => [t.id, t])), [allTerms]);

  // Resume-dialog gating. `startChoice` is:
  //  - 'unresolved' → still deciding (or waiting for the learner)
  //  - 'fresh'      → start a new session (no resumeSessionId)
  //  - 'resume'     → resume the fetched inflight session
  // We only enable useLearnSession once a choice is locked in, so the
  // hook doesn't POST /sessions before the dialog is answered.
  const { data: inflight, isLoading: inflightLoading } = useInflightLearnSession(
    moduleId,
    !moduleLoading && !termsLoading && allTerms.length > 0,
  );
  const invalidateInflight = useInvalidateInflightLearnSession();

  const [startChoice, setStartChoice] = useState<'unresolved' | 'fresh' | 'resume'>(
    urlSessionId ? 'resume' : 'unresolved',
  );
  const [choiceBusy, setChoiceBusy] = useState(false);

  // Auto-resolve to 'fresh' when we know there's no inflight session.
  // The dialog only shows when we have a real in-flight row to offer.
  if (startChoice === 'unresolved' && !inflightLoading && !inflight && !urlSessionId) {
    setStartChoice('fresh');
  }

  const initialResumeState =
    startChoice === 'resume' && inflight?.resumeState
      ? (inflight.resumeState as unknown as LearnResumeState)
      : null;
  const resumeSessionId =
    startChoice === 'resume' ? (urlSessionId ?? inflight?.sessionId) : undefined;

  const enabled =
    !moduleLoading && !termsLoading && allTerms.length > 0 && startChoice !== 'unresolved';

  const {
    sessionId,
    status,
    error,
    summary,
    currentCard,
    latestProgress,
    answers,
    currentBatchAnswers,
    lastResult,
    hasMoreCards,
    atBatchBoundary,
    submitMc,
    submitWritten,
    skipCurrent,
    reQueueCurrent,
    markCurrentCorrect,
    advance,
    finish,
    retry,
  } = useLearnSession({
    moduleId,
    enabled,
    resumeSessionId,
    initialState: initialResumeState,
    batchSize: preferences?.batchSize,
    dueFirst,
  });

  async function handleStartFresh() {
    if (!inflight) {
      setStartChoice('fresh');
      return;
    }
    setChoiceBusy(true);
    try {
      await abandonSession(inflight.sessionId);
    } catch {
      // Non-fatal — the sweep will pick it up. Continue with a fresh
      // start regardless.
    } finally {
      await invalidateInflight(moduleId);
      setChoiceBusy(false);
      setStartChoice('fresh');
    }
  }

  async function handleResume() {
    setStartChoice('resume');
  }

  // Auto-advance timing comes from per-set preferences. When
  // autoAdvance is off, the effect no-ops and the learner clicks
  // "Next" manually.
  // Correct answers auto-advance after a short hold so the learner
  // can register the win without another click. Wrong answers wait
  // for an explicit Next click — that's where the learner needs a
  // moment to read the diff, decide to override, or re-queue. The
  // `preferences.autoAdvance` toggle is no longer surfaced; behaviour
  // is fixed to "auto on correct, manual on wrong".
  const holdMs = preferences?.autoAdvanceMs ?? feedbackHoldMs;
  const lastWasCorrect = !!lastResult?.correct;

  // Round-up screen state — shown between batches. No auto-close: the
  // learner dismisses with any key or the Continue button so they
  // can dwell on the recap for as long as they want.
  const [roundupOpen, setRoundupOpen] = useState(false);

  // Study-preferences dialog can be opened mid-session from the
  // header. Setting changes apply to the next batch — the current
  // one keeps whatever it started with.
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (status !== 'showing-feedback') return;
    if (roundupOpen) return;
    // At a batch boundary the round-up handler below takes over —
    // it opens the recap after the same hold and dismissal calls
    // advance() itself.
    if (atBatchBoundary) return;
    if (!lastWasCorrect) return; // wrong-answer feedback waits for Next click
    holdRef.current = setTimeout(() => {
      void advance();
    }, holdMs);
    return () => {
      if (holdRef.current) clearTimeout(holdRef.current);
    };
  }, [status, atBatchBoundary, lastWasCorrect, holdMs, roundupOpen, advance]);

  // Round-up trigger: only auto-opens on the last card of a batch
  // when the learner just answered correctly. If the last-in-batch
  // answer was wrong, the round-up opens when the learner clicks
  // Next (handled inline below).
  const roundupTriggerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!atBatchBoundary) return;
    if (!lastWasCorrect) return;
    roundupTriggerRef.current = setTimeout(() => {
      setRoundupOpen(true);
    }, holdMs);
    return () => {
      if (roundupTriggerRef.current) clearTimeout(roundupTriggerRef.current);
    };
  }, [atBatchBoundary, lastWasCorrect, holdMs]);

  const dismissRoundup = useCallback(() => {
    setRoundupOpen(false);
    void advance();
  }, [advance]);

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

  const [hintUsedByCard, setHintUsedByCard] = useState<Record<string, boolean>>({});
  const markHintUsed = useCallback(
    (cardId: string) => {
      setHintUsedByCard((prev) => (prev[cardId] ? prev : { ...prev, [cardId]: true }));
    },
    [setHintUsedByCard],
  );

  // Global keyboard shortcuts. Registered once on the page — we skip
  // dispatch whenever the learner is typing into an input/textarea/
  // contentEditable so `1`, `H`, `S`, etc. don't hijack a written
  // answer. `Space` always advances during feedback regardless of
  // focus (it doesn't insert into the textarea because we scope the
  // check to non-text targets first).
  useEffect(() => {
    function isTyping(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Round-up: any key dismisses.
      if (roundupOpen) {
        e.preventDefault();
        dismissRoundup();
        return;
      }

      // 1-4 selects an MC choice — even when the textarea is focused
      // we don't want to interpret it, so we skip for typing targets.
      if (currentCard?.promptType === 'LEARN_MC' && !isTyping(e.target)) {
        const idx = ['1', '2', '3', '4'].indexOf(e.key);
        if (idx !== -1 && (currentCard.choices?.length ?? 0) > idx) {
          e.preventDefault();
          if (status !== 'showing-feedback') {
            const hintUsedForCard = !!hintUsedByCard[currentCard.cardId];
            void submitMc({
              selectedChoiceIndex: idx,
              hintUsed: hintUsedForCard,
            });
          }
          return;
        }
      }

      // Any key advances a *correct* feedback screen — bypasses the
      // hold timer. Wrong feedback stays put so the learner reaches
      // for the "I answered correctly" / "Show me again" / Next
      // buttons instead of accidentally advancing past them.
      if (status === 'showing-feedback' && lastResult?.correct && !isTyping(e.target)) {
        e.preventDefault();
        if (holdRef.current) clearTimeout(holdRef.current);
        void advance();
        return;
      }

      // S skips the current card, H reveals the hint. Suppress while
      // typing so a written answer with an "s" or "h" isn't consumed.
      if (isTyping(e.target)) return;
      if (e.key === 's' || e.key === 'S') {
        if (currentCard && status !== 'showing-feedback' && !roundupOpen) {
          e.preventDefault();
          void skipCurrent();
        }
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        if (
          currentCard &&
          currentCard.hint &&
          status !== 'showing-feedback' &&
          !hintUsedByCard[currentCard.cardId]
        ) {
          e.preventDefault();
          markHintUsed(currentCard.cardId);
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    currentCard,
    status,
    lastResult,
    roundupOpen,
    hintUsedByCard,
    submitMc,
    advance,
    skipCurrent,
    markHintUsed,
    dismissRoundup,
  ]);

  // ============================================
  // states: loading / empty / error / complete / summary / active
  // ============================================

  if (moduleLoading || termsLoading || status === 'starting' || inflightLoading) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-3 px-6">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  // Resume-dialog gate: nothing else renders until the learner picks.
  if (startChoice === 'unresolved' && inflight) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-3 px-6">
        <ResumeSessionDialog
          open
          session={inflight}
          busy={choiceBusy}
          onResume={handleResume}
          onStartFresh={handleStartFresh}
        />
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
              <Button variant="outline" onClick={() => router.push(`/modules/${moduleId}`)}>
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
    // Disambiguate: an empty batch under the starred-only filter is
    // "no starred cards", not "all mastered". Handing the empty state
    // an unstick action lets the learner clear the filter in one tap
    // instead of digging into settings.
    if (preferences?.starredOnly) {
      return (
        <EmptyPanel
          moduleId={moduleId}
          reason="no-starred"
          onClearStarredFilter={async () => {
            await updatePreferences.mutateAsync({ starredOnly: false });
            // The current session already pulled an empty batch under
            // the old filter. Bounce back to the module page so the
            // Learn entry re-runs the inflight lookup and pulls a
            // fresh batch with starredOnly = false.
            router.push(`/modules/${moduleId}`);
          }}
          clearing={updatePreferences.isPending}
        />
      );
    }
    return <EmptyPanel moduleId={moduleId} reason="all-mastered" />;
  }

  const isSessionEnd =
    sessionId !== null && !hasMoreCards && currentCard === null && answers.length > 0;
  if (isSessionEnd) {
    if (status === 'error' && error) {
      return <SessionResultsError error={error} onRetry={finish} moduleId={moduleId} />;
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPreferencesOpen(true)}
          aria-label="Study preferences"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Settings
        </Button>
      </div>

      {/* Progress breakdown: NEW / LEARNING / MASTERED. Replaces the
          old single mastery bar so learners can see all three cohorts
          shrink and grow through the session. */}
      <ProgressBreakdown progress={latestProgress} answeredThisSession={answers.length} />

      {roundupOpen ? (
        <BatchRoundup
          items={buildRoundupItems(currentBatchAnswers, termsByCardId)}
          onContinue={dismissRoundup}
          onToggleStar={(cardId, nextStarred) =>
            toggleStar.mutate({ id: cardId, isStarred: nextStarred })
          }
        />
      ) : (
        <>
          {/* Prompt */}
          <PromptCard
            card={currentCard}
            hintUsed={hintUsed}
            onHint={() => markHintUsed(currentCard.cardId)}
            lastResult={lastResult}
            isSubmitting={status === 'showing-feedback'}
            onSubmitMc={(selectedChoiceIndex) => submitMc({ selectedChoiceIndex, hintUsed })}
            onSubmitWritten={(userAnswer) => submitWritten({ userAnswer, hintUsed })}
          />

          {/* Action row: skip + review-again + next. Kept below the
              card so it doesn't crowd the prompt itself. Skip only
              renders pre-answer; review-again + next render during
              feedback. */}
          <CardActions
            status={status}
            lastResult={lastResult}
            atBatchBoundary={atBatchBoundary}
            onSkip={() => void skipCurrent()}
            onReviewAgain={reQueueCurrent}
            onMarkCorrect={() => void markCurrentCorrect()}
            onNext={() => {
              if (holdRef.current) clearTimeout(holdRef.current);
              if (atBatchBoundary) {
                // Wrong-answer batch boundary: no auto-open timer
                // fired for this, so open the round-up ourselves.
                setRoundupOpen(true);
              } else {
                void advance();
              }
            }}
          />

          <ShortcutLegend hasHint={!!currentCard.hint} />
        </>
      )}

      {/* Mid-session settings — same dialog as the module page.
          Changes apply to the next batch, not the one in flight, so
          learners can tweak without disrupting their current run. */}
      <StudyPreferencesDialog
        open={preferencesOpen}
        onOpenChange={setPreferencesOpen}
        setId={moduleId}
      />
    </main>
  );
}

// ============================================================
// Progress breakdown — NEW / LEARNING / MASTERED bar + counts
// ============================================================

function ProgressBreakdown({
  progress,
  answeredThisSession,
}: {
  progress: {
    totalCards: number;
    newCount: number;
    learningCount: number;
    masteredCount: number;
  } | null;
  answeredThisSession: number;
}) {
  if (!progress || progress.totalCards === 0) {
    return <p className="text-sm text-neutral-500">Answered {answeredThisSession} this session.</p>;
  }
  const { totalCards, newCount, learningCount, masteredCount } = progress;
  const remaining = newCount + learningCount;
  const pct = (n: number) => (totalCards > 0 ? (n / totalCards) * 100 : 0);

  return (
    <div className="space-y-2">
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-black/5">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${pct(masteredCount)}%` }}
        />
        <div
          className="h-full bg-amber-400 transition-all"
          style={{ width: `${pct(learningCount)}%` }}
        />
        <div
          className="h-full bg-neutral-300 transition-all"
          style={{ width: `${pct(newCount)}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-3 text-neutral-600">
          <BreakdownChip color="emerald" label="Mastered" value={masteredCount} />
          <BreakdownChip color="amber" label="Learning" value={learningCount} />
          <BreakdownChip color="neutral" label="New" value={newCount} />
        </div>
        <p className="text-neutral-500">
          ~{remaining} left · {answeredThisSession} answered this session
        </p>
      </div>
    </div>
  );
}

function BreakdownChip({
  color,
  label,
  value,
}: {
  color: 'emerald' | 'amber' | 'neutral';
  label: string;
  value: number;
}) {
  const dotClass = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-400',
    neutral: 'bg-neutral-300',
  }[color];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('h-2 w-2 rounded-full', dotClass)} />
      <span className="font-medium text-neutral-800">{value}</span>
      <span className="text-neutral-500">{label}</span>
    </span>
  );
}

// ============================================================
// Card action bar — skip / review-again / next
// ============================================================

function CardActions({
  status,
  lastResult,
  atBatchBoundary,
  onSkip,
  onReviewAgain,
  onMarkCorrect,
  onNext,
}: {
  status:
    | 'idle'
    | 'starting'
    | 'loading-batch'
    | 'active'
    | 'showing-feedback'
    | 'completing'
    | 'complete'
    | 'error';
  lastResult: LearnCardResult | null;
  atBatchBoundary: boolean;
  onSkip: () => void;
  onReviewAgain: () => void;
  onMarkCorrect: () => void;
  onNext: () => void;
}) {
  const showingFeedback = status === 'showing-feedback';
  const wasWrong = lastResult ? !lastResult.correct : false;
  const nextLabel = atBatchBoundary ? 'See round-up' : 'Next';

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        {!showingFeedback && (
          <Button variant="ghost" size="sm" onClick={onSkip}>
            <SkipForward className="h-4 w-4" />
            Skip
          </Button>
        )}
      </div>
      {/* Wrong-only action row: override, re-queue, and Next. Correct
          answers auto-advance so no button is shown — the learner
          just watches the card change (or bumps any key to speed it
          up, handled globally). */}
      {showingFeedback && wasWrong && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onMarkCorrect}
            className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
          >
            <ThumbsUp className="h-4 w-4" />I answered correctly
          </Button>
          <Button variant="outline" size="sm" onClick={onReviewAgain}>
            <RotateCw className="h-4 w-4" />
            Show me again
          </Button>
          <Button size="sm" onClick={onNext}>
            {nextLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Keyboard shortcut legend
// ============================================================

function ShortcutLegend({ hasHint }: { hasHint: boolean }) {
  return (
    <p className="text-center text-xs text-neutral-500">
      <kbd className={kbdClass}>1</kbd>–<kbd className={kbdClass}>4</kbd> choose ·{' '}
      <kbd className={kbdClass}>any key</kbd> next after correct · <kbd className={kbdClass}>S</kbd>{' '}
      skip
      {hasHint && (
        <>
          {' '}
          · <kbd className={kbdClass}>H</kbd> hint
        </>
      )}
    </p>
  );
}

// ============================================================
// Between-batch round-up
// ============================================================

interface RoundupItem {
  cardId: string;
  term: string;
  definition: string;
  isStarred: boolean;
  status: 'correct' | 'incorrect' | 'skipped';
  graduated: boolean;
}

/**
 * Collapse the raw answer log into one row per card for the round-up
 * list. Deduplicates on cardId keeping the LATEST answer — matters
 * when the learner used "Show me again" (reQueueCurrent appends the
 * card and it comes back around within the same batch). The final
 * outcome is the one that mastery reflects.
 *
 * When a card's term isn't in the terms map (rare — terms load
 * separately from the batch API and could be briefly out of sync),
 * we fall back to a placeholder so the list still renders instead of
 * blanking the whole recap.
 */
function buildRoundupItems(
  answers: {
    cardId: string;
    correct: boolean;
    graduated: boolean;
    skipped?: boolean;
  }[],
  termsByCardId: Map<string, { id: string; term: string; definition: string; isStarred: boolean }>,
): RoundupItem[] {
  const latestByCardId = new Map<
    string,
    { correct: boolean; graduated: boolean; skipped?: boolean }
  >();
  for (const a of answers) {
    latestByCardId.set(a.cardId, {
      correct: a.correct,
      graduated: a.graduated,
      skipped: a.skipped,
    });
  }

  return Array.from(latestByCardId.entries()).map(([cardId, latest]) => {
    const term = termsByCardId.get(cardId);
    return {
      cardId,
      term: term?.term ?? '—',
      definition: term?.definition ?? '',
      isStarred: term?.isStarred ?? false,
      status: latest.skipped
        ? ('skipped' as const)
        : latest.correct
          ? ('correct' as const)
          : ('incorrect' as const),
      graduated: latest.graduated,
    };
  });
}

function BatchRoundup({
  items,
  onContinue,
  onToggleStar,
}: {
  items: RoundupItem[];
  onContinue: () => void;
  onToggleStar: (cardId: string, isStarred: boolean) => void;
}) {
  // Recap counts. `graduated` = graduated in this batch; `wrong` and
  // `skipped` are the negative buckets; `correct` covers everything
  // marked right (whether it graduated or not).
  const graduated = items.filter((i) => i.graduated).length;
  const wrong = items.filter((i) => i.status === 'incorrect').length;
  const skipped = items.filter((i) => i.status === 'skipped').length;
  const correct = items.filter((i) => i.status === 'correct').length;

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Batch complete
          </p>
          <h2 className="text-2xl font-bold text-neutral-900">Round-up</h2>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile color="emerald" label="Mastered" value={graduated} />
          <StatTile color="brand" label="Correct" value={correct} />
          <StatTile color="rose" label="Missed" value={wrong} />
          <StatTile color="amber" label="Skipped" value={skipped} />
        </div>

        {items.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Cards in this batch
            </p>
            <ul className="space-y-2">
              {items.map((item) => (
                <RoundupCardRow
                  key={item.cardId}
                  item={item}
                  onToggleStar={() => onToggleStar(item.cardId, !item.isStarred)}
                />
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-xs text-neutral-500">
            Press <kbd className={kbdClass}>any key</kbd> to continue.
          </p>
          <Button size="sm" onClick={onContinue}>
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * One row per card in the round-up list. Star toggle on the left,
 * term/definition in the middle, outcome badge on the right. Star
 * uses optimistic-cached mutation from useToggleTermStar so the fill
 * flips instantly.
 */
function RoundupCardRow({ item, onToggleStar }: { item: RoundupItem; onToggleStar: () => void }) {
  const badge = statusBadges[item.status];
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white p-3">
      <button
        type="button"
        onClick={onToggleStar}
        aria-label={item.isStarred ? 'Unstar card' : 'Star card'}
        title={item.isStarred ? 'Starred' : 'Star this card'}
        className={cn(
          'shrink-0 rounded-full p-1.5 transition-colors',
          item.isStarred
            ? 'text-amber-500 hover:text-amber-600'
            : 'text-neutral-300 hover:text-amber-400',
        )}
      >
        <Star className={cn('h-5 w-5', item.isStarred && 'fill-current')} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-neutral-900">{item.term}</p>
        {item.definition && <p className="truncate text-sm text-neutral-500">{item.definition}</p>}
      </div>
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
          badge.cls,
        )}
      >
        <badge.icon className="h-3.5 w-3.5" />
        {badge.label}
      </span>
    </li>
  );
}

const statusBadges: Record<
  RoundupItem['status'],
  { label: string; icon: typeof CheckCircle2; cls: string }
> = {
  correct: {
    label: 'Correct',
    icon: CheckCircle2,
    cls: 'bg-emerald-50 text-emerald-700',
  },
  incorrect: {
    label: 'Missed',
    icon: XCircle,
    cls: 'bg-rose-50 text-rose-700',
  },
  skipped: {
    label: 'Skipped',
    icon: SkipForward,
    cls: 'bg-amber-50 text-amber-700',
  },
};

function StatTile({
  color,
  label,
  value,
}: {
  color: 'emerald' | 'brand' | 'rose' | 'amber';
  label: string;
  value: number;
}) {
  const cls = {
    emerald: 'bg-emerald-50 text-emerald-800',
    brand: 'bg-brand-300/20 text-neutral-800',
    rose: 'bg-rose-50 text-rose-800',
    amber: 'bg-amber-50 text-amber-800',
  }[color];
  return (
    <div className={cn('rounded-2xl p-3', cls)}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium">{label}</p>
    </div>
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
              {card.promptType === 'LEARN_MC' ? 'Choose the definition' : 'Type the definition'}
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
            term={card.term}
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
    if (idx === lastResult.selectedChoiceIndex && !lastResult.correct) return 'wrong';
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
              <span className="flex-1 text-base leading-relaxed text-neutral-800">{choice}</span>
              {state === 'correct' && (
                <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-emerald-600" />
              )}
              {state === 'wrong' && <XCircle className="ml-auto h-5 w-5 shrink-0 text-rose-600" />}
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
  term,
  lastResult,
  disabled,
  onSubmit,
}: {
  term: string;
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
    return <WrittenFeedback term={term} result={lastResult} />;
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
        className={writtenFieldClass}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-neutral-500">
          <kbd className={kbdClass}>Enter</kbd> submit · <kbd className={kbdClass}>Shift+Enter</kbd>{' '}
          newline
        </span>
        <Button onClick={handleSubmit} disabled={disabled || !value.trim()}>
          Submit
        </Button>
      </div>
    </div>
  );
}

function WrittenFeedback({
  term,
  result,
}: {
  term: string;
  result: LearnCardResult & { kind: 'written' };
}) {
  const isTypo = result.matchType === 'TYPO_ACCEPTED';
  const isExact = result.matchType === 'EXACT';
  const isWrong = result.matchType === 'WRONG';
  const matchedAlternate =
    result.matchedAgainst.trim().toLowerCase() !== result.correctAnswer.trim().toLowerCase();

  return (
    <div
      className={cn(
        'space-y-3 rounded-2xl border p-4',
        result.correct ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50',
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

      {/* On an EXACT match the diff-and-alternate block is skipped, but
          the feedback panel would otherwise carry no term/definition
          context. Show the pair inline so the learner sees the card
          they just aced without scrolling back to the prompt. */}
      {isExact && (
        <p className="text-sm text-neutral-700">
          <span className="font-semibold text-neutral-900">{term}</span>
          <span className="mx-2 text-neutral-400">→</span>
          <span>{result.correctAnswer}</span>
        </p>
      )}

      {!isExact && (
        <div className="space-y-2 text-sm text-neutral-700">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-xs uppercase tracking-wide text-neutral-500">You typed</span>
            <DiffText diff={result.diff} />
          </div>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-xs uppercase tracking-wide text-neutral-500">
              {matchedAlternate ? 'Accepted as' : 'Correct answer'}
            </span>
            <InlineChip tone="emerald">{result.matchedAgainst}</InlineChip>
            {matchedAlternate && (
              <span className="text-xs text-neutral-500">
                (alternate for “{result.correctAnswer}”)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Renders a character-level diff produced by the write-evaluator on the
 * server. Each segment is colored by its type — a `wrong` run reads as
 * highlighted incorrect input, `extra` is what the learner over-typed,
 * `missing` is what they omitted (rendered struck-through to signal
 * "should be here"), and `match` is the shared skeleton.
 */
type WrittenResult = Extract<LearnCardResult, { kind: 'written' }>;

function DiffText({ diff }: { diff: WrittenResult['diff'] }) {
  if (!diff || diff.length === 0) return null;
  return (
    <span className="rounded-md bg-white/70 px-2 py-1 font-mono text-[13px] leading-relaxed">
      {diff.map((seg, i) => {
        const key = `${seg.type}-${i}`;
        switch (seg.type) {
          case 'match':
            return (
              <span key={key} className="text-neutral-800">
                {seg.text}
              </span>
            );
          case 'wrong':
            return (
              <span key={key} className="rounded-sm bg-rose-200/70 px-0.5 text-rose-900">
                {seg.text}
              </span>
            );
          case 'extra':
            return (
              <span
                key={key}
                className="rounded-sm bg-amber-200/70 px-0.5 text-amber-900 line-through"
              >
                {seg.text}
              </span>
            );
          case 'missing':
            return (
              <span key={key} className="rounded-sm bg-emerald-200/70 px-0.5 text-emerald-900">
                {seg.text}
              </span>
            );
          default:
            return null;
        }
      })}
    </span>
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
    <span className={cn('rounded-md px-1.5 py-0.5 font-mono text-[13px]', cls)}>{children}</span>
  );
}

// ============================================================
// Empty / finish / summary panels
// ============================================================

function EmptyPanel({
  moduleId,
  reason,
  onClearStarredFilter,
  clearing,
}: {
  moduleId: string;
  reason: NonNullable<EmptyReason>;
  onClearStarredFilter?: () => void | Promise<void>;
  clearing?: boolean;
}) {
  const router = useRouter();
  const title =
    reason === 'no-terms'
      ? 'No terms to study'
      : reason === 'no-starred'
        ? 'No starred cards'
        : "You've mastered every card";
  const body =
    reason === 'no-terms'
      ? "This module doesn't have any flashcards yet. Add some terms first."
      : reason === 'no-starred'
        ? "The starred-only filter is on, but you haven't starred any cards in this module. Clear the filter to study everything, or star a few cards first."
        : "There's nothing left to learn in this module. Reset your progress to run through it again, or try another mode.";
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-6 py-12">
      <Card>
        <CardContent className="space-y-3">
          <p className="text-lg font-semibold text-neutral-900">{title}</p>
          <p className="text-sm text-neutral-600">{body}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={() => router.push(`/modules/${moduleId}`)}>Back to module</Button>
            {reason === 'no-starred' && onClearStarredFilter && (
              <Button variant="outline" onClick={onClearStarredFilter} disabled={clearing}>
                {clearing ? 'Clearing…' : 'Clear starred filter'}
              </Button>
            )}
            {reason === 'all-mastered' && (
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
