'use client';

/**
 * Test Mode — server-generated, server-graded quiz.
 *
 * Flow: mount → POST /test-attempts spawns the attempt + returns
 * sanitized questions (no correct answers). Learner navigates the
 * question list, answering per-type controls (MC pick, written text,
 * TF T/F, matching pair selection). On submit, POST
 * /test-attempts/:id/submit grades everything and returns the review
 * result which the ResultsScreen renders.
 *
 * Distinct from Learn Mode: no pause/resume, no batches, no
 * incremental server calls per question — one create + one submit.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  GripVertical,
  Loader2,
  Play,
  RotateCw,
  SlidersHorizontal,
  X,
  XCircle,
} from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { TestAttemptResult, TestQuestion, TestQuestionResult } from '@/lib/api';
import { useTestAttempt, type AnswerState } from '@/lib/hooks/useTestAttempt';
import { useModule } from '@/lib/hooks/useModules';
import { useTerms } from '@/lib/hooks/useTerms';
import { useTestPreferences } from '@/lib/hooks/useTestPreferences';
import { TestPreferencesDialog } from '@/components/TestPreferencesDialog';

export default function TestModeClient({ moduleId }: { moduleId: string }) {
  const searchParams = useSearchParams();
  const reviewAttemptId = searchParams.get('review') ?? undefined;

  const { data: moduleData, isLoading: moduleLoading } = useModule(moduleId);
  const { data: allTerms = [], isLoading: termsLoading } = useTerms(moduleId);

  // Pre-test setup gate — a test is a graded, single-sitting event
  // so we don't want to auto-spawn an attempt on mount. Learner
  // reviews / tunes preferences on the setup screen, then clicks
  // "Start test" which flips `hasStarted` and enables the hook.
  // The gate is bypassed when we're hydrating a review deep-link.
  const [hasStarted, setHasStarted] = useState(!!reviewAttemptId);
  const enabled =
    !moduleLoading && !termsLoading && allTerms.length > 0 && (hasStarted || !!reviewAttemptId);

  // Settings dialog — used from both the pre-test screen and the
  // in-test header. Changes apply to the *next* attempt.
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const {
    status,
    error,
    attempt,
    questions,
    result,
    answers,
    elapsedMs,
    setAnswer,
    submit,
    retry,
  } = useTestAttempt({ moduleId, enabled, reviewAttemptId });

  // Continuous-scroll layout doesn't need global keyboard nav —
  // each question is always visible, and per-type controls (MC
  // choice buttons, TF pills, written input) handle their own
  // focus/click behavior. Nothing to wire here.

  // ============================================
  // states: loading / empty / error / results / active
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
    return (
      <EmptyPanel
        moduleId={moduleId}
        title="No terms to test"
        body="This module doesn't have any flashcards yet. Add some terms first."
      />
    );
  }

  // Pre-test setup — before hasStarted flips true, show a card with
  // the current preferences summary + Configure + Start CTAs. Skipped
  // when we're hydrating a review deep-link (?review=<attemptId>).
  if (!hasStarted && !reviewAttemptId) {
    return (
      <>
        <PreTestSetupScreen
          moduleId={moduleId}
          moduleTitle={moduleData?.data?.title ?? ''}
          onStart={() => setHasStarted(true)}
          onOpenPreferences={() => setPreferencesOpen(true)}
        />
        <TestPreferencesDialog
          open={preferencesOpen}
          onOpenChange={setPreferencesOpen}
          setId={moduleId}
        />
      </>
    );
  }

  if (status === 'error' && error) {
    return <ErrorPanel moduleId={moduleId} error={error} onRetry={retry} />;
  }

  // Review of a completed attempt (either just-submitted or opened
  // via ?review=<attemptId>).
  if (status === 'complete' && result) {
    return <ResultsScreen moduleId={moduleId} result={result} onRetake={retry} />;
  }

  if (!attempt || questions.length === 0) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-3 px-6">
        <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
      </main>
    );
  }

  const answeredCount = Object.keys(answers).filter((qid) => {
    const a = answers[qid];
    return (
      (a.userAnswer && a.userAnswer.length > 0) ||
      a.selectedChoiceIndex !== undefined ||
      a.userIsTrue !== undefined ||
      (a.matchingPicks && Object.values(a.matchingPicks).some((v) => v !== null))
    );
  }).length;

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
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreferencesOpen(true)}
              aria-label="Test preferences"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Settings
            </Button>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-neutral-700">
              <Clock className="h-3.5 w-3.5" />
              {formatElapsed(elapsedMs)}
            </span>
          </div>
          <span className="text-xs text-neutral-500">
            {answeredCount} / {questions.length} answered
          </span>
        </div>
      </div>

      {/* Progress bar — reflects answered-of-total across the whole
          test, since there's no "current" question in a scroll view. */}
      <ProgressBar current={answeredCount} total={questions.length} />

      {/* Continuous scrollable list — one card per question, all
          visible at once. The learner scrolls / fills / submits. */}
      <div className="space-y-4">
        {questions.map((q, i) => (
          <QuestionCard
            key={q.questionAttemptId}
            index={i + 1}
            question={q}
            answer={answers[q.questionAttemptId]}
            onAnswer={(patch) => setAnswer(q.questionAttemptId, patch)}
          />
        ))}
      </div>

      {/* Sticky-ish submit bar at the bottom of the scroll. */}
      <div className="sticky bottom-4 z-10 rounded-2xl border border-black/10 bg-white/95 p-3 shadow-lg backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-neutral-600">
            <span className="font-semibold text-neutral-900">{answeredCount}</span> of{' '}
            {questions.length} answered
            {answeredCount < questions.length && (
              <span className="ml-1 text-neutral-500">
                · unanswered questions count as incorrect
              </span>
            )}
          </p>
          <Button size="sm" onClick={() => void submit()} disabled={status === 'submitting'}>
            {status === 'submitting' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Grading…
              </>
            ) : (
              <>
                Submit test
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Mid-test settings — changes apply to the next attempt. */}
      <TestPreferencesDialog
        open={preferencesOpen}
        onOpenChange={setPreferencesOpen}
        setId={moduleId}
      />
    </main>
  );
}

// ============================================================
// Question card — dispatches on questionType
// ============================================================

function QuestionCard({
  index,
  question,
  answer,
  onAnswer,
}: {
  index: number;
  question: TestQuestion;
  answer: AnswerState | undefined;
  onAnswer: (patch: Partial<AnswerState>) => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-5">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            <span className="text-brand-600">Question {index}</span>
            <span className="mx-2 text-neutral-300">·</span>
            {question.questionType === 'TEST_MC' && 'Choose the answer'}
            {question.questionType === 'TEST_WRITTEN' && 'Type the answer'}
            {question.questionType === 'TEST_TF' && 'True or false?'}
            {question.questionType === 'TEST_MATCH' && 'Match the pairs'}
          </p>
          <p className="wrap-break-word text-2xl font-semibold text-neutral-900 sm:text-3xl">
            {question.promptText}
          </p>
        </div>

        {question.questionType === 'TEST_MC' && (
          <McQuestion question={question} answer={answer} onAnswer={onAnswer} />
        )}
        {question.questionType === 'TEST_WRITTEN' && (
          <WrittenQuestion answer={answer} onAnswer={onAnswer} />
        )}
        {question.questionType === 'TEST_TF' && (
          <TfQuestion question={question} answer={answer} onAnswer={onAnswer} />
        )}
        {question.questionType === 'TEST_MATCH' && (
          <MatchingQuestion question={question} answer={answer} onAnswer={onAnswer} />
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// MC renderer
// ============================================================

function McQuestion({
  question,
  answer,
  onAnswer,
}: {
  question: TestQuestion;
  answer: AnswerState | undefined;
  onAnswer: (patch: Partial<AnswerState>) => void;
}) {
  const choices = question.choices ?? [];
  const selected = answer?.selectedChoiceIndex ?? null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {choices.map((choice, idx) => {
        const isSelected = selected === idx;
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onAnswer({ selectedChoiceIndex: idx })}
            className={cn(
              'rounded-2xl border p-4 text-left transition-all',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300/40',
              isSelected
                ? 'border-brand-500 bg-brand-500/10'
                : 'border-black/10 bg-white hover:border-brand-400 hover:bg-brand-300/10',
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs',
                  isSelected ? 'bg-brand-500 text-white' : 'bg-neutral-100 text-neutral-600',
                )}
              >
                {idx + 1}
              </span>
              <span className="flex-1 text-base leading-relaxed text-neutral-800">{choice}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// WRITTEN renderer
// ============================================================

function WrittenQuestion({
  answer,
  onAnswer,
}: {
  answer: AnswerState | undefined;
  onAnswer: (patch: Partial<AnswerState>) => void;
}) {
  const value = answer?.userAnswer ?? '';
  return (
    <div className="space-y-3">
      <Input
        autoFocus
        value={value}
        onChange={(e) => onAnswer({ userAnswer: e.target.value })}
        placeholder="Type your answer…"
        className="text-base"
      />
      <p className="text-xs text-neutral-500">
        Your answer is saved as you type. You can revisit any question before submitting.
      </p>
    </div>
  );
}

// ============================================================
// TF renderer
// ============================================================

function TfQuestion({
  question,
  answer,
  onAnswer,
}: {
  question: TestQuestion;
  answer: AnswerState | undefined;
  onAnswer: (patch: Partial<AnswerState>) => void;
}) {
  const presented = question.tfPresentedAnswer ?? '';
  const userIsTrue = answer?.userIsTrue;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/10 bg-neutral-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Is this the correct pairing?
        </p>
        <p className="mt-1 text-base leading-relaxed text-neutral-800">{presented}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TfPill active={userIsTrue === true} onClick={() => onAnswer({ userIsTrue: true })}>
          <CheckCircle2 className="h-5 w-5" />
          True
        </TfPill>
        <TfPill active={userIsTrue === false} onClick={() => onAnswer({ userIsTrue: false })}>
          <XCircle className="h-5 w-5" />
          False
        </TfPill>
      </div>
    </div>
  );
}

function TfPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-2 rounded-2xl border p-4 font-semibold transition-all',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300/40',
        active
          ? 'border-brand-500 bg-brand-500 text-white'
          : 'border-black/10 bg-white text-neutral-800 hover:border-brand-400 hover:bg-brand-300/10',
      )}
    >
      {children}
    </button>
  );
}

// ============================================================
// MATCHING renderer — dnd-kit drag & drop
// ============================================================

/**
 * Drag candidate pills from the pool onto anchor slots. Dropping onto
 * an already-filled slot swaps the previous pill back into the pool.
 * Clicking the small X on a placed pill returns it to the pool. Same
 * candidate can never be picked for two anchors (single-source of
 * truth: `matchingPicks[pairId] -> flashcardId | null`).
 *
 * Draggable id  = `cand:<flashcardId>`
 * Droppable ids = `anchor:<pairId>` (slots) and `pool` (return-pill).
 */
function MatchingQuestion({
  question,
  answer,
  onAnswer,
}: {
  question: TestQuestion;
  answer: AnswerState | undefined;
  onAnswer: (patch: Partial<AnswerState>) => void;
}) {
  const pairs = question.matchingPairs ?? [];
  const picks = answer?.matchingPicks ?? {};
  const candidates = pairs.map((p) => ({
    flashcardId: p.flashcardId,
    text: p.candidateText,
  }));
  const candidateById = new Map(candidates.map((c) => [c.flashcardId, c] as const));
  const usedIds = new Set(Object.values(picks).filter(Boolean) as string[]);
  const poolCandidates = candidates.filter((c) => !usedIds.has(c.flashcardId));

  const [dragId, setDragId] = useState<string | null>(null);

  // A small pointer delta before dnd activates prevents clicks
  // (e.g. on the pill's X button) from being swallowed as drags.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const setPick = (pairId: string, flashcardId: string | null) => {
    onAnswer({ matchingPicks: { ...picks, [pairId]: flashcardId } });
  };

  const findPairForCandidate = (flashcardId: string): string | null => {
    for (const [pairId, cid] of Object.entries(picks)) {
      if (cid === flashcardId) return pairId;
    }
    return null;
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDragId(null);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (!activeId.startsWith('cand:')) return;
    const flashcardId = activeId.slice('cand:'.length);
    const sourcePairId = findPairForCandidate(flashcardId);

    if (overId.startsWith('anchor:')) {
      const targetPairId = overId.slice('anchor:'.length);
      if (sourcePairId === targetPairId) return;
      const displaced = picks[targetPairId] ?? null;
      const next = { ...picks };
      if (sourcePairId) next[sourcePairId] = displaced;
      next[targetPairId] = flashcardId;
      onAnswer({ matchingPicks: next });
    } else if (overId === 'pool' && sourcePairId) {
      setPick(sourcePairId, null);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))}
      onDragCancel={() => setDragId(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        <CandidatePool candidates={poolCandidates} dragId={dragId} />
        <div className="space-y-2">
          {pairs.map((pair) => {
            const pickedId = picks[pair.pairId] ?? null;
            const picked = pickedId ? candidateById.get(pickedId) : undefined;
            return (
              <AnchorRow
                key={pair.pairId}
                pairId={pair.pairId}
                anchorText={pair.anchorText}
                pickedFlashcardId={pickedId}
                pickedText={picked?.text}
                onRemove={() => setPick(pair.pairId, null)}
                isDragging={!!dragId && !!pickedId && dragId === `cand:${pickedId}`}
              />
            );
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragId && dragId.startsWith('cand:')
          ? (() => {
              const flashcardId = dragId.slice('cand:'.length);
              const c = candidateById.get(flashcardId);
              return c ? <CandidatePill text={c.text} dragging /> : null;
            })()
          : null}
      </DragOverlay>
    </DndContext>
  );
}

function CandidatePool({
  candidates,
  dragId,
}: {
  candidates: { flashcardId: string; text: string }[];
  dragId: string | null;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: 'pool' });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-16 rounded-2xl border border-dashed p-3 transition-colors',
        isOver ? 'border-brand-400 bg-brand-300/10' : 'border-black/15 bg-neutral-50',
      )}
    >
      {candidates.length === 0 ? (
        <p className="py-3 text-center text-xs text-neutral-400">
          All candidates placed — drop one here to return it to the pool.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {candidates.map((c) => (
            <DraggableCandidate
              key={c.flashcardId}
              flashcardId={c.flashcardId}
              text={c.text}
              hidden={dragId === `cand:${c.flashcardId}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DraggableCandidate({
  flashcardId,
  text,
  hidden,
}: {
  flashcardId: string;
  text: string;
  hidden?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `cand:${flashcardId}`,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn('touch-none', (hidden || isDragging) && 'invisible')}
    >
      <CandidatePill text={text} />
    </div>
  );
}

function CandidatePill({ text, dragging }: { text: string; dragging?: boolean }) {
  return (
    <div
      className={cn(
        'inline-flex cursor-grab items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-sm text-neutral-800 shadow-sm transition-all',
        'hover:border-brand-400',
        dragging
          ? 'cursor-grabbing border-brand-500 shadow-lg ring-4 ring-brand-300/40'
          : 'border-black/10',
      )}
    >
      <GripVertical className="h-3.5 w-3.5 text-neutral-400" />
      <span>{text}</span>
    </div>
  );
}

function AnchorRow({
  pairId,
  anchorText,
  pickedFlashcardId,
  pickedText,
  onRemove,
  isDragging,
}: {
  pairId: string;
  anchorText: string;
  pickedFlashcardId: string | null;
  pickedText: string | undefined;
  onRemove: () => void;
  isDragging: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `anchor:${pairId}` });
  return (
    <div className="grid grid-cols-1 items-center gap-2 rounded-2xl border border-black/10 bg-white p-3 sm:grid-cols-[1fr_auto_1fr]">
      <div className="min-w-0 font-medium text-neutral-900">{anchorText}</div>
      <div className="hidden text-neutral-400 sm:block">→</div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-11 items-center rounded-xl border-2 border-dashed px-2 py-1 transition-colors',
          isOver
            ? 'border-brand-500 bg-brand-300/10'
            : pickedFlashcardId
              ? 'border-transparent bg-neutral-50'
              : 'border-black/15 bg-neutral-50',
        )}
      >
        {pickedFlashcardId && pickedText ? (
          <div
            className={cn(
              'flex w-full items-center justify-between gap-2',
              isDragging && 'opacity-30',
            )}
          >
            <PlacedCandidate flashcardId={pickedFlashcardId} text={pickedText} />
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove match"
              className="rounded-full p-1 text-neutral-400 hover:bg-black/5 hover:text-neutral-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <span className="px-1 text-xs text-neutral-400">Drop a match here</span>
        )}
      </div>
    </div>
  );
}

function PlacedCandidate({ flashcardId, text }: { flashcardId: string; text: string }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `cand:${flashcardId}`,
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className="touch-none">
      <CandidatePill text={text} />
    </div>
  );
}

// ============================================================
// Progress bar
// ============================================================

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5">
        <div
          className="h-full rounded-full bg-brand-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-right text-xs text-neutral-500">
        Question {current} of {total}
      </p>
    </div>
  );
}

// ============================================================
// Pre-test setup screen
// ============================================================

function PreTestSetupScreen({
  moduleId,
  moduleTitle,
  onStart,
  onOpenPreferences,
}: {
  moduleId: string;
  moduleTitle: string;
  onStart: () => void;
  onOpenPreferences: () => void;
}) {
  const { data: prefs, isLoading } = useTestPreferences(moduleId);
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-6 py-8 sm:px-8">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/modules/${moduleId}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to module
          </Link>
        </Button>
        {moduleTitle && (
          <h1 className="mt-2 truncate text-2xl font-bold text-neutral-900 md:text-3xl">
            {moduleTitle}
          </h1>
        )}
        <p className="mt-1 text-sm text-neutral-500">
          Set up your test, then start when you&apos;re ready.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Test setup
              </p>
              <p className="mt-1 font-semibold text-neutral-900">Review your preferences</p>
            </div>
            <Button variant="outline" size="sm" onClick={onOpenPreferences}>
              <SlidersHorizontal className="h-4 w-4" />
              Edit
            </Button>
          </div>

          {isLoading || !prefs ? (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading preferences…
            </div>
          ) : (
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SummaryItem label="Questions" value={String(prefs.questionCount)} />
              <SummaryItem
                label="Question types"
                value={
                  prefs.allowedTypes.length === 0
                    ? '—'
                    : prefs.allowedTypes.map((t) => questionTypeLabel(t)).join(', ')
                }
              />
              {prefs.allowedTypes.includes('TEST_MATCH') && (
                <SummaryItem label="Pairs per matching" value={String(prefs.matchingPairCount)} />
              )}
              <SummaryItem
                label="Answer direction"
                value={answerDirectionLabel(prefs.answerDirection)}
              />
              <SummaryItem label="Strictness" value={strictnessLabel(prefs.strictness)} />
              <SummaryItem label="Starred only" value={prefs.starredOnly ? 'On' : 'Off'} />
              <SummaryItem label="Shuffle" value={prefs.shuffleEnabled ? 'On' : 'Off'} />
              <SummaryItem
                label="Per-question feedback"
                value={prefs.showResultsPerQuestion ? 'On' : 'Off'}
              />
            </dl>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs text-neutral-500">
              Preferences save automatically and apply to your next test.
            </p>
            <Button
              onClick={onStart}
              disabled={isLoading || !prefs || prefs.allowedTypes.length === 0}
            >
              <Play className="h-4 w-4" />
              Start test
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/5 bg-neutral-50 px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium text-neutral-900">{value}</dd>
    </div>
  );
}

function answerDirectionLabel(dir: string): string {
  switch (dir) {
    case 'TERM_TO_DEFINITION':
      return 'Term → Definition';
    case 'DEFINITION_TO_TERM':
      return 'Definition → Term';
    case 'MIXED':
      return 'Mixed';
    default:
      return dir;
  }
}

function strictnessLabel(s: string): string {
  switch (s) {
    case 'STRICT':
      return 'Strict';
    case 'NORMAL':
      return 'Normal';
    case 'LENIENT':
      return 'Lenient';
    default:
      return s;
  }
}

// ============================================================
// Results screen
// ============================================================

function ResultsScreen({
  moduleId,
  result,
  onRetake,
}: {
  moduleId: string;
  result: TestAttemptResult;
  onRetake: () => void;
}) {
  const router = useRouter();
  const pct = Math.round(result.score);
  const scoreTone = result.score >= 80 ? 'emerald' : result.score >= 60 ? 'amber' : 'rose';
  const toneClasses = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    rose: 'bg-rose-50 border-rose-200 text-rose-800',
  }[scoreTone];

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-6 py-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/modules/${moduleId}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to module
          </Link>
        </Button>
      </div>

      {/* Score header */}
      <Card>
        <CardContent className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Test complete
          </p>
          <div className={cn('rounded-3xl border p-6 text-center', toneClasses)}>
            <p className="text-6xl font-bold">{pct}%</p>
            <p className="mt-1 text-sm font-medium">
              {result.correctCount} of {result.totalQuestions} correct
            </p>
          </div>
          {result.durationSeconds != null && (
            <p className="text-center text-xs text-neutral-500">
              Finished in {formatElapsed(result.durationSeconds * 1000)}
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            <Button onClick={onRetake}>
              <RotateCw className="h-4 w-4" />
              Take another test
            </Button>
            <Button variant="outline" onClick={() => router.push(`/modules/${moduleId}`)}>
              Back to module
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Per-question review */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">Review</h2>
        {result.questions.map((q, i) => (
          <ReviewCard key={q.questionAttemptId} question={q} index={i + 1} />
        ))}
      </div>
    </main>
  );
}

function ReviewCard({ question, index }: { question: TestQuestionResult; index: number }) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Question {index} · {questionTypeLabel(question.questionType)}
          </p>
          <StatusBadge isCorrect={question.isCorrect} />
        </div>

        <p className="font-semibold text-neutral-900">{question.promptText}</p>

        {question.questionType === 'TEST_MATCH' && question.pairs ? (
          <MatchingReview pairs={question.pairs} />
        ) : (
          <SingleAnswerReview question={question} />
        )}
      </CardContent>
    </Card>
  );
}

function SingleAnswerReview({ question }: { question: TestQuestionResult }) {
  const isTF = question.questionType === 'TEST_TF';
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-xs uppercase tracking-wide text-neutral-500">Your answer</span>
        <span
          className={cn(
            'rounded-md px-2 py-0.5 font-medium',
            question.isCorrect
              ? 'bg-emerald-100/70 text-emerald-800'
              : 'bg-rose-100/70 text-rose-800',
          )}
        >
          {question.userAnswer ?? <span className="italic opacity-70">no answer</span>}
        </span>
      </div>
      {!question.isCorrect && (
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-xs uppercase tracking-wide text-neutral-500">Correct answer</span>
          <span className="rounded-md bg-emerald-100/70 px-2 py-0.5 font-medium text-emerald-800">
            {isTF
              ? question.correctChoiceIndex === 0
                ? 'true'
                : 'false'
              : question.expectedAnswer}
          </span>
        </div>
      )}
    </div>
  );
}

function MatchingReview({ pairs }: { pairs: NonNullable<TestQuestionResult['pairs']> }) {
  return (
    <div className="space-y-1.5 text-sm">
      {pairs.map((pair) => (
        <div
          key={pair.pairId}
          className={cn(
            'flex items-center justify-between gap-2 rounded-lg px-3 py-1.5',
            pair.isCorrect ? 'bg-emerald-50' : 'bg-rose-50',
          )}
        >
          <span className="font-mono text-xs text-neutral-500">pair {pair.pairId.slice(0, 6)}</span>
          {pair.isCorrect ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <XCircle className="h-4 w-4 text-rose-600" />
          )}
        </div>
      ))}
      <p className="text-xs text-neutral-500">
        {pairs.filter((p) => p.isCorrect).length} of {pairs.length} pairs correct.
      </p>
    </div>
  );
}

function StatusBadge({ isCorrect }: { isCorrect: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
        isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
      )}
    >
      {isCorrect ? (
        <>
          <CheckCircle2 className="h-3.5 w-3.5" />
          Correct
        </>
      ) : (
        <>
          <XCircle className="h-3.5 w-3.5" />
          Wrong
        </>
      )}
    </span>
  );
}

function questionTypeLabel(type: string): string {
  switch (type) {
    case 'TEST_MC':
      return 'Multiple choice';
    case 'TEST_WRITTEN':
      return 'Written';
    case 'TEST_TF':
      return 'True / False';
    case 'TEST_MATCH':
      return 'Matching';
    default:
      return type;
  }
}

// ============================================================
// Empty + error panels
// ============================================================

function EmptyPanel({ moduleId, title, body }: { moduleId: string; title: string; body: string }) {
  const router = useRouter();
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-6 py-12">
      <Card>
        <CardContent className="space-y-3">
          <p className="text-lg font-semibold text-neutral-900">{title}</p>
          <p className="text-sm text-neutral-600">{body}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={() => router.push(`/modules/${moduleId}`)}>Back to module</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function ErrorPanel({
  moduleId,
  error,
  onRetry,
}: {
  moduleId: string;
  error: string;
  onRetry: () => void;
}) {
  const router = useRouter();
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-6 py-12">
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-rose-600" />
            <p className="text-lg font-semibold text-neutral-900">Couldn&apos;t start the test</p>
          </div>
          <p className="text-sm text-neutral-600">{error}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onRetry}>Try again</Button>
            <Button variant="outline" onClick={() => router.push(`/modules/${moduleId}`)}>
              Back to module
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

// ============================================================
// Utilities
// ============================================================

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}
