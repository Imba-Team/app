"use client";

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

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Lightbulb,
  Loader2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import SessionResults, {
  SessionResultsError,
  SessionResultsLoading,
} from "../_components/SessionResults";
import { useModule } from "@/lib/hooks/useModules";
import { useTerms } from "@/lib/hooks/useTerms";
import {
  useLearnSession,
  type LearnCardResult,
} from "@/lib/hooks/useLearnSession";
import type { LearnBatchCard } from "@/lib/api";

// Hold the correctness feedback on-screen this long before auto-
// advancing. Long enough for the learner to internalise the correct
// answer, short enough that the pace stays brisk.
const FEEDBACK_HOLD_MS = 1400;

// After a session with no non-mastered cards the server returns an
// empty batch on the first call; render an appropriate empty state
// instead of a completion screen.
type EmptyReason = "no-terms" | "all-mastered" | null;

export default function LearnModeClient({ moduleId }: { moduleId: string }) {
  const router = useRouter();
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
  } = useLearnSession({ moduleId, enabled });

  // Auto-advance timer. Held in a ref so we can cancel on unmount /
  // manual advance.
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (status !== "showing-feedback") return;
    holdRef.current = setTimeout(() => {
      void advance();
    }, FEEDBACK_HOLD_MS);
    return () => {
      if (holdRef.current) clearTimeout(holdRef.current);
    };
  }, [status, advance]);

  // Auto-finish when the session runs out of non-mastered cards. Guard
  // with a ref so React StrictMode's dev double-invoke and the render
  // between `active` and `complete` don't refire finish().
  const autoFinishedRef = useRef(false);
  useEffect(() => {
    const sessionDone =
      sessionId !== null &&
      !hasMoreCards &&
      currentCard === null &&
      status === "active" &&
      answers.length > 0;
    if (sessionDone && !autoFinishedRef.current) {
      autoFinishedRef.current = true;
      void finish();
    }
  }, [sessionId, hasMoreCards, currentCard, status, answers.length, finish]);

  // Per-card hint tracker (survives feedback → next card boundary).
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

  if (moduleLoading || termsLoading || status === "starting") {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </main>
    );
  }

  if (allTerms.length === 0) {
    return (
      <EmptyPanel
        moduleId={moduleId}
        reason="no-terms"
      />
    );
  }

  // Session start / batch fetch error — before any answers, so it's a
  // "try starting again" story, not a save-summary retry.
  if (status === "error" && error && !summary && answers.length === 0) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle className="text-rose-700">
              Couldn&apos;t start Learn Mode
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">{error}</p>
            <div className="flex gap-2">
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

  // Server had no non-mastered cards on the first batch — nothing was
  // ever answered, so there's no session to summarise.
  const noCardsToStudy =
    sessionId !== null &&
    !hasMoreCards &&
    currentCard === null &&
    answers.length === 0 &&
    status !== "loading-batch";
  if (noCardsToStudy) {
    return <EmptyPanel moduleId={moduleId} reason="all-mastered" />;
  }

  // Deck exhausted mid-session. Auto-finish takes over via the effect
  // above and lands on SessionResults once the summary resolves.
  const isSessionEnd =
    sessionId !== null &&
    !hasMoreCards &&
    currentCard === null &&
    answers.length > 0;
  if (isSessionEnd) {
    if (status === "error" && error) {
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

  if (!currentCard || status === "loading-batch") {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 size={16} className="animate-spin" />
          Loading next batch…
        </div>
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
    <main className="min-h-screen bg-gray-100 overflow-x-hidden">
      {/* Header */}
      <div className="max-w-3xl mx-auto pt-8 px-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <button
              onClick={() => router.push(`/modules/${moduleId}`)}
              className="text-sm text-gray-500 hover:text-[#4255FF] flex items-center gap-1"
            >
              <ArrowLeft size={16} /> Back to module
            </button>
            {moduleData?.data && (
              <h1 className="text-2xl md:text-3xl font-bold text-[#4255FF] mt-2 truncate">
                {moduleData.data.title}
              </h1>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm text-gray-500">
              Answered {answers.length}
            </p>
            {mastered !== undefined && total !== undefined && (
              <p className="text-xs text-gray-400">
                {mastered}/{total} mastered
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Prompt */}
      <div className="max-w-3xl mx-auto p-6 mt-6">
        <PromptCard
          card={currentCard}
          hintUsed={hintUsed}
          onHint={() => markHintUsed(currentCard.cardId)}
          lastResult={lastResult}
          isSubmitting={status === "showing-feedback"}
          onSubmitMc={(selectedChoiceIndex) =>
            submitMc({ selectedChoiceIndex, hintUsed })
          }
          onSubmitWritten={(userAnswer) =>
            submitWritten({ userAnswer, hintUsed })
          }
        />
      </div>
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
      <CardContent className="p-6 space-y-6">
        {/* Prompt term + hint control */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">
              {card.promptType === "LEARN_MC"
                ? "Choose the definition"
                : "Type the definition"}
            </p>
            <p className="text-2xl sm:text-3xl font-semibold text-gray-900 break-words">
              {card.term}
            </p>
            {card.hint && hintUsed && (
              <p className="mt-3 text-sm bg-amber-50 border border-amber-200 rounded px-3 py-2 text-amber-800">
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
              title={hintUsed ? "Hint used (halves credit)" : "Reveal hint"}
              className={cn(
                "shrink-0 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors",
                hintUsed
                  ? "text-amber-600 border-amber-300 bg-amber-50"
                  : "text-gray-500 border-gray-200 hover:bg-gray-50",
                (isSubmitting || hintUsed) && "cursor-default",
              )}
            >
              <Lightbulb size={14} />
              {hintUsed ? "Hint used" : "Hint"}
            </button>
          )}
        </div>

        {card.promptType === "LEARN_MC" ? (
          <McChoices
            card={card}
            lastResult={lastResult?.kind === "mc" ? lastResult : null}
            disabled={isSubmitting}
            onSubmit={onSubmitMc}
          />
        ) : (
          <WrittenPrompt
            key={card.cardId}
            lastResult={lastResult?.kind === "written" ? lastResult : null}
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
  lastResult: (LearnCardResult & { kind: "mc" }) | null;
  disabled: boolean;
  onSubmit: (selectedChoiceIndex: number) => void;
}) {
  const choices = card.choices ?? [];
  const showingFeedback = lastResult !== null;

  const choiceState = (idx: number): "idle" | "correct" | "wrong" | "muted" => {
    if (!showingFeedback) return "idle";
    if (idx === lastResult.correctChoiceIndex) return "correct";
    if (idx === lastResult.selectedChoiceIndex && !lastResult.correct)
      return "wrong";
    return "muted";
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
              "text-left rounded-xl border-2 p-4 transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4255FF]/40",
              state === "idle" &&
                "border-gray-200 hover:border-[#4255FF] hover:bg-[#4255FF]/5",
              state === "correct" && "border-emerald-500 bg-emerald-50",
              state === "wrong" && "border-rose-500 bg-rose-50",
              state === "muted" && "border-gray-200 opacity-50",
              disabled && "cursor-default",
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "font-mono text-xs border rounded px-1.5 py-0.5 shrink-0 mt-0.5",
                  state === "correct" &&
                    "border-emerald-300 text-emerald-700 bg-white",
                  state === "wrong" &&
                    "border-rose-300 text-rose-700 bg-white",
                  state === "idle" && "border-gray-300 text-gray-500",
                  state === "muted" && "border-gray-300 text-gray-400",
                )}
              >
                {idx + 1}
              </span>
              <span className="text-base leading-relaxed">{choice}</span>
              {state === "correct" && (
                <CheckCircle2
                  size={18}
                  className="ml-auto text-emerald-600 shrink-0"
                />
              )}
              {state === "wrong" && (
                <XCircle size={18} className="ml-auto text-rose-600 shrink-0" />
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
  lastResult: (LearnCardResult & { kind: "written" }) | null;
  disabled: boolean;
  onSubmit: (userAnswer: string) => void;
}) {
  const [value, setValue] = useState("");
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
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="Type your answer…"
        rows={3}
        disabled={disabled}
        className="w-full min-h-24 px-3 py-2 border border-gray-200 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-[#4255FF]/40 focus:border-[#4255FF] disabled:bg-gray-50 text-base leading-relaxed"
      />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs text-gray-500">
          <kbd className="font-mono border border-gray-300 rounded px-1">
            Enter
          </kbd>{" "}
          submit ·{" "}
          <kbd className="font-mono border border-gray-300 rounded px-1">
            Shift+Enter
          </kbd>{" "}
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
  result,
}: {
  result: LearnCardResult & { kind: "written" };
}) {
  const isTypo = result.matchType === "TYPO_ACCEPTED";
  const isExact = result.matchType === "EXACT";
  const isWrong = result.matchType === "WRONG";
  const pct = Math.round(result.similarity * 100);

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "rounded-xl border-2 p-4",
          result.correct
            ? "border-emerald-500 bg-emerald-50"
            : "border-rose-500 bg-rose-50",
        )}
      >
        <div className="flex items-center gap-2">
          {result.correct ? (
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
          ) : (
            <XCircle size={20} className="text-rose-600 shrink-0" />
          )}
          <p className="font-semibold">
            {isExact && "Perfect."}
            {isTypo && "Close enough — counted as correct."}
            {isWrong && "Not quite."}
          </p>
        </div>

        {isTypo && (
          <p className="text-sm text-gray-700 mt-2">
            You typed{" "}
            <span className="bg-white px-1.5 py-0.5 rounded border border-amber-200 font-mono">
              {result.normalizedInput}
            </span>{" "}
            — expected{" "}
            <span className="bg-white px-1.5 py-0.5 rounded border border-emerald-200 font-mono">
              {result.correctAnswer}
            </span>
            {" "}({result.editDistance} character{result.editDistance === 1 ? "" : "s"} off).
          </p>
        )}

        {isWrong && (
          <div className="text-sm text-gray-700 mt-2 space-y-1">
            <p>
              You typed{" "}
              <span className="bg-white px-1.5 py-0.5 rounded border border-rose-200 font-mono">
                {result.normalizedInput}
              </span>
            </p>
            <p>
              Correct answer:{" "}
              <span className="bg-white px-1.5 py-0.5 rounded border border-emerald-200 font-mono">
                {result.correctAnswer}
              </span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Similarity {pct}%.
            </p>
          </div>
        )}
      </div>
    </div>
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
  const noTerms = reason === "no-terms";
  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle>
            {noTerms ? "No terms to study" : "You've mastered every card"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-gray-600">
            {noTerms
              ? "This module doesn't have any flashcards yet. Add some terms first."
              : "There's nothing left to learn in this module. Reset your progress to run through it again, or try another mode."}
          </p>
          <div className="flex gap-2 flex-wrap">
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

