/**
 * Learn-mode session lifecycle (TDD Sprint 6 / §8a).
 *
 * The client stays dumb about which prompt to show — the server picks
 * LEARN_MC vs LEARN_WRITTEN per card based on the learner's current
 * weighted streak, and hands back 7-10 cards at a time via
 * GET /sessions/:id/next-batch. This hook loops until the server
 * reports `hasMoreCards === false`, then completes.
 *
 * MC answers hit POST /sessions/:id/answer (studyMode LEARN_MC), typed
 * answers hit POST /sessions/:id/answer-written (studyMode
 * LEARN_WRITTEN). Both are idempotent via a client-generated attemptId.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  completeSession,
  getNextLearnBatch,
  markAnswerCorrect,
  pauseSession,
  startSession,
  submitSessionAnswer,
  submitWrittenAnswer,
  type AnswerResponse,
  type LearnBatchCard,
  type LearnResumeState,
  type ResolvedAnswerDirection,
  type SessionSummary,
  type WrittenAnswerResponse,
} from "@/lib/api";

/**
 * LearnBatchCard.answerDirection is typed as the full Prisma enum
 * (TERM_TO_DEFINITION | DEFINITION_TO_TERM | MIXED) because that's
 * what the schema exposes. At runtime the server only ever sends the
 * two concrete values — MIXED is a preference, not a per-card value.
 * This helper narrows for the submit DTOs; anything unexpected just
 * degrades to undefined and the server falls back to the preference.
 */
function resolvedDirectionOf(
  card: LearnBatchCard,
): ResolvedAnswerDirection | undefined {
  return card.answerDirection === "TERM_TO_DEFINITION" ||
    card.answerDirection === "DEFINITION_TO_TERM"
    ? card.answerDirection
    : undefined;
}

export type LearnMcResult = {
  kind: "mc";
  correct: boolean;
  correctChoiceIndex: number;
  selectedChoiceIndex: number;
  correctAnswer: string;
  graduated: boolean;
  demoted: boolean;
};

export type LearnWrittenResult = {
  kind: "written";
  matchType: WrittenAnswerResponse["evaluation"]["matchType"];
  similarity: number;
  editDistance: number;
  normalizedInput: string;
  normalizedExpected: string;
  /** Raw text of the candidate the input actually matched against —
   *  either the primary definition or an author-provided alternate. */
  matchedAgainst: string;
  /** Segment-by-segment char diff for the feedback panel. */
  diff: WrittenAnswerResponse["evaluation"]["diff"];
  correct: boolean;
  correctAnswer: string;
  graduated: boolean;
  demoted: boolean;
};

export type LearnCardResult = LearnMcResult | LearnWrittenResult;

export type LearnAnswerRecord = {
  cardId: string;
  promptType: LearnBatchCard["promptType"];
  hintUsed: boolean;
  correct: boolean;
  graduated: boolean;
  demoted: boolean;
  /** True when the learner explicitly skipped the card. Skipped
   *  attempts count as INCORRECT-like for correctness, but they don't
   *  update mastery on the server (studyMode weight applies to
   *  CORRECT/INCORRECT only). Round-up displays them separately. */
  skipped?: boolean;
};

type Status =
  | "idle"
  | "starting"
  | "loading-batch"
  | "active"
  | "showing-feedback"
  | "completing"
  | "complete"
  | "error";

interface UseLearnSessionOptions {
  moduleId: string;
  /** Enabled once the caller knows the module has at least one non-mastered card. */
  enabled: boolean;
  batchSize?: number;
  /**
   * If provided, resume this existing session instead of creating a
   * new one. When `initialState` is also supplied, the first-batch
   * fetch is skipped in favor of hydrating from the server-round-tripped
   * snapshot. If the id is stale, the batch call will 404 and surface
   * as a normal error.
   */
  resumeSessionId?: string;
  /**
   * Server-persisted resume state fetched via GET /sessions/inflight.
   * When present, the hook hydrates the batch from this snapshot
   * instead of calling next-batch — so the learner returns to the
   * same cards they left rather than getting a fresh mix.
   */
  initialState?: LearnResumeState | null;
  /**
   * When true, every batch pull asks the server to prioritize cards
   * that are due today per SRS. Falls back to the normal
   * learning/new mix once no due cards remain — the batch always
   * fills.
   */
  dueFirst?: boolean;
}

export interface UseLearnSessionReturn {
  sessionId: string | null;
  status: Status;
  error: string | null;
  summary: SessionSummary | null;
  currentCard: LearnBatchCard | null;
  batchIndex: number;
  batchSize: number;
  totalAnswered: number;
  latestProgress: AnswerResponse["setProgress"] | null;
  answers: LearnAnswerRecord[];
  /** Answers that belong to the current batch — reset every time the
   *  hook pulls a fresh batch. Feeds the round-up screen. */
  currentBatchAnswers: LearnAnswerRecord[];
  lastResult: LearnCardResult | null;
  hasMoreCards: boolean;
  /** True when the learner has just answered the last card of a batch
   *  and another batch is coming. The UI uses this to decide whether
   *  to advance directly or show a round-up first. */
  atBatchBoundary: boolean;
  submitMc: (input: {
    selectedChoiceIndex: number;
    hintUsed: boolean;
  }) => Promise<void>;
  submitWritten: (input: {
    userAnswer: string;
    hintUsed: boolean;
  }) => Promise<void>;
  /** Send SKIPPED for the current card and move on. Server records the
   *  attempt but the mastery engine leaves the card untouched. */
  skipCurrent: () => Promise<void>;
  /** Client-only: re-queue the current card at the end of the batch so
   *  the learner can try it again. Used from the "Show me again"
   *  affordance after a wrong answer. No server call — the original
   *  attempt is already logged. */
  reQueueCurrent: () => void;
  /** "I answered correctly" override. Only meaningful when the last
   *  result is a wrong one — flips it to correct on the server and
   *  refreshes the local result/progress so the feedback panel shows
   *  the corrected state. */
  markCurrentCorrect: () => Promise<void>;
  advance: () => Promise<void>;
  finish: () => Promise<void>;
  retry: () => void;
}

function newAttemptId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function useLearnSession({
  moduleId,
  enabled,
  batchSize = 10,
  resumeSessionId,
  initialState,
  dueFirst = false,
}: UseLearnSessionOptions): UseLearnSessionReturn {
  const [sessionId, setSessionId] = useState<string | null>(
    resumeSessionId ?? null,
  );
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [batch, setBatch] = useState<LearnBatchCard[]>([]);
  const [batchIndex, setBatchIndex] = useState(0);
  const [hasMoreCards, setHasMoreCards] = useState(true);
  const [answers, setAnswers] = useState<LearnAnswerRecord[]>([]);
  const [lastResult, setLastResult] = useState<LearnCardResult | null>(null);
  const [latestProgress, setLatestProgress] = useState<
    AnswerResponse["setProgress"] | null
  >(null);
  // How many answers had been logged when the current batch was
  // loaded — used to slice `answers` down to the just-completed batch
  // for the round-up screen.
  const [batchStartAnswerCount, setBatchStartAnswerCount] = useState(0);
  // Snapshot of the current in-flight state, updated on every batch /
  // answer transition. Read by the pause-on-unmount effect so we can
  // POST /sessions/:id/pause without having to close over the latest
  // React state (which would need every state setter to be in the
  // effect's deps).
  const currentStateRef = useRef<LearnResumeState | null>(null);

  const startedRef = useRef(false);
  const [attemptKey, setAttemptKey] = useState(0);

  // Wall-clock timestamp captured whenever a new card becomes the
  // current prompt. Used to derive `responseMs` on submit so the server
  // can log it against the CardAttempt audit row. Nullable window guard
  // for SSR — `performance.now()` isn't defined in a Node render pass.
  const cardShownAtRef = useRef<number | null>(null);

  // Session start + first batch — folded into one status transition
  // (idle → starting → active) so the caller doesn't see a flicker
  // through an intermediate empty-batch state.
  useEffect(() => {
    if (!enabled || startedRef.current) return;
    startedRef.current = true;
    setStatus("starting");
    setError(null);

    (async () => {
      try {
        // Resume path: skip the POST /sessions round-trip; the server
        // has the session row already.
        const startedSessionId =
          resumeSessionId ??
          (await startSession(moduleId, "LEARN")).sessionId;
        setSessionId(startedSessionId);

        // Hydrate from the server-persisted snapshot when the caller
        // handed us one. That's the "resume where I left off" path —
        // learner sees the same cards they paused on. Otherwise fall
        // back to the fresh next-batch pull.
        if (resumeSessionId && initialState && initialState.batch.length > 0) {
          setBatch(initialState.batch);
          setBatchIndex(
            Math.min(initialState.batchIndex, initialState.batch.length - 1),
          );
          setHasMoreCards(initialState.hasMoreCards);
          setBatchStartAnswerCount(0);
          setStatus("active");
        } else {
          const first = await getNextLearnBatch(startedSessionId, batchSize, {
            dueFirst,
          });
          setBatch(first.cards);
          setBatchIndex(0);
          setHasMoreCards(first.hasMoreCards);
          setBatchStartAnswerCount(0);
          setStatus(first.cards.length > 0 ? "active" : "complete");
        }
      } catch (err) {
        startedRef.current = false;
        setError((err as Error).message);
        setStatus("error");
      }
    })();
  }, [
    enabled,
    moduleId,
    batchSize,
    attemptKey,
    resumeSessionId,
    initialState,
    dueFirst,
  ]);

  const retry = useCallback(() => {
    if (startedRef.current) return;
    setAttemptKey((k) => k + 1);
  }, []);

  const currentCard = batch[batchIndex] ?? null;

  // Reset the timer whenever the visible card changes. Runs after
  // render so the timer captures roughly when the learner sees it.
  // Key on cardId+batchIndex — a re-shuffle to the same card also
  // restarts the clock.
  const currentCardId = currentCard?.cardId;
  useEffect(() => {
    if (typeof performance === "undefined") return;
    cardShownAtRef.current = currentCardId ? performance.now() : null;
  }, [currentCardId, batchIndex]);

  // Keep the resume snapshot ref current on every batch/index change.
  // Cheap and lets the unmount effect below fire off a pause without
  // needing every state setter in its deps.
  useEffect(() => {
    currentStateRef.current = {
      batch,
      batchIndex,
      hasMoreCards,
      savedAt: new Date().toISOString(),
    };
  }, [batch, batchIndex, hasMoreCards]);

  // Pause-on-unmount: best-effort snapshot when the learner navigates
  // away mid-session. Only fires when the session is still ACTIVE
  // (status refs "active" or "showing-feedback") and hasn't been
  // completed. Runs as a plain fetch — modern browsers usually let
  // an in-flight POST land during unmount, but we don't guarantee it.
  // The server-side abandoned-session sweep is the safety net.
  const sessionIdRef = useRef<string | null>(null);
  const statusRef = useRef<Status>("idle");
  useEffect(() => {
    sessionIdRef.current = sessionId;
    statusRef.current = status;
  }, [sessionId, status]);
  useEffect(() => {
    return () => {
      const id = sessionIdRef.current;
      const st = statusRef.current;
      if (!id) return;
      if (st === "complete" || st === "completing" || st === "error") return;
      const snapshot = currentStateRef.current;
      void pauseSession(id, snapshot ?? undefined).catch(() => {
        // Swallow — the sweep will mark it ABANDONED if pause fails.
      });
    };
  }, []);

  function elapsedMs(): number | undefined {
    if (typeof performance === "undefined") return undefined;
    const start = cardShownAtRef.current;
    if (start === null) return undefined;
    return Math.max(0, Math.round(performance.now() - start));
  }

  // Advance to the next card. If the current batch is spent, either
  // fetch the next batch (server said `hasMoreCards`) or leave the
  // deck empty so the page can render the completion prompt.
  const advance = useCallback(async () => {
    if (!sessionId) return;
    setLastResult(null);
    const isLastInBatch = batchIndex >= batch.length - 1;
    if (!isLastInBatch) {
      setBatchIndex((i) => i + 1);
      setStatus("active");
      return;
    }
    if (!hasMoreCards) {
      setBatch([]);
      setBatchIndex(0);
      setStatus("active"); // Page decides to call finish() from here.
      return;
    }
    setStatus("loading-batch");
    try {
      const next = await getNextLearnBatch(sessionId, batchSize, { dueFirst });
      setBatch(next.cards);
      setBatchIndex(0);
      setHasMoreCards(next.hasMoreCards);
      // Track where the next batch starts in the answers array so the
      // round-up can slice out just that batch's answers on the next
      // boundary.
      setBatchStartAnswerCount(answers.length);
      setStatus(next.cards.length > 0 ? "active" : "active");
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    }
  }, [
    sessionId,
    batch.length,
    batchIndex,
    hasMoreCards,
    batchSize,
    dueFirst,
    answers.length,
  ]);

  const submitMc = useCallback(
    async ({
      selectedChoiceIndex,
      hintUsed,
    }: {
      selectedChoiceIndex: number;
      hintUsed: boolean;
    }) => {
      if (!sessionId || !currentCard || currentCard.promptType !== "LEARN_MC")
        return;
      if (
        currentCard.correctChoiceIndex === undefined ||
        !currentCard.choices
      )
        return;

      const correctChoiceIndex = currentCard.correctChoiceIndex;
      const correct = selectedChoiceIndex === correctChoiceIndex;
      const outcome = correct ? "CORRECT" : "INCORRECT";
      const attemptId = newAttemptId();
      const responseMs = elapsedMs();

      try {
        const res = await submitSessionAnswer(sessionId, {
          attemptId,
          cardId: currentCard.cardId,
          studyMode: "LEARN_MC",
          outcome,
          hintUsed,
          responseMs,
          answerDirection: resolvedDirectionOf(currentCard),
        });
        setLatestProgress(res.setProgress);
        setAnswers((prev) => [
          ...prev,
          {
            cardId: currentCard.cardId,
            promptType: "LEARN_MC",
            hintUsed,
            correct,
            graduated: res.graduated,
            demoted: res.demoted,
          },
        ]);
        setLastResult({
          kind: "mc",
          correct,
          correctChoiceIndex,
          selectedChoiceIndex,
          correctAnswer: res.correctAnswer,
          graduated: res.graduated,
          demoted: res.demoted,
        });
        setStatus("showing-feedback");
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [sessionId, currentCard],
  );

  const submitWritten = useCallback(
    async ({
      userAnswer,
      hintUsed,
    }: {
      userAnswer: string;
      hintUsed: boolean;
    }) => {
      if (
        !sessionId ||
        !currentCard ||
        currentCard.promptType !== "LEARN_WRITTEN"
      )
        return;

      const attemptId = newAttemptId();
      const responseMs = elapsedMs();
      try {
        const res = await submitWrittenAnswer(sessionId, {
          attemptId,
          cardId: currentCard.cardId,
          studyMode: "LEARN_WRITTEN",
          userAnswer,
          hintUsed,
          responseMs,
          answerDirection: resolvedDirectionOf(currentCard),
        });
        setLatestProgress(res.setProgress);
        setAnswers((prev) => [
          ...prev,
          {
            cardId: currentCard.cardId,
            promptType: "LEARN_WRITTEN",
            hintUsed,
            correct: res.correct,
            graduated: res.graduated,
            demoted: res.demoted,
          },
        ]);
        setLastResult({
          kind: "written",
          matchType: res.evaluation.matchType,
          similarity: res.evaluation.similarity,
          editDistance: res.evaluation.editDistance,
          normalizedInput: res.evaluation.normalizedInput,
          normalizedExpected: res.evaluation.normalizedExpected,
          matchedAgainst: res.evaluation.matchedAgainst,
          diff: res.evaluation.diff,
          correct: res.correct,
          correctAnswer: res.correctAnswer,
          graduated: res.graduated,
          demoted: res.demoted,
        });
        setStatus("showing-feedback");
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [sessionId, currentCard],
  );

  const finish = useCallback(async () => {
    if (!sessionId || status === "completing" || status === "complete") return;
    setStatus("completing");
    try {
      const res = await completeSession(sessionId);
      setSummary(res);
      setStatus("complete");
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    }
  }, [sessionId, status]);

  const skipCurrent = useCallback(async () => {
    if (!sessionId || !currentCard) return;
    const attemptId = newAttemptId();
    const responseMs = elapsedMs();
    // Skips send SKIPPED to the server — mastery is untouched but
    // CardAttempt logs it for analytics. `hintUsed` is always false
    // for skips regardless of whether the hint was revealed; the
    // hint doesn't factor into a skip.
    try {
      await submitSessionAnswer(sessionId, {
        attemptId,
        cardId: currentCard.cardId,
        studyMode:
          currentCard.promptType === "LEARN_MC" ? "LEARN_MC" : "LEARN_WRITTEN",
        outcome: "SKIPPED",
        hintUsed: false,
        responseMs,
        answerDirection: resolvedDirectionOf(currentCard),
      });
      setAnswers((prev) => [
        ...prev,
        {
          cardId: currentCard.cardId,
          promptType: currentCard.promptType,
          hintUsed: false,
          correct: false,
          graduated: false,
          demoted: false,
          skipped: true,
        },
      ]);
      // Skip goes straight to the next card — no feedback screen.
      await advance();
    } catch (err) {
      setError((err as Error).message);
    }
  }, [sessionId, currentCard, advance]);

  const markCurrentCorrect = useCallback(async () => {
    if (!sessionId || !lastResult || lastResult.correct) return;
    const targetCardId =
      lastResult.kind === "written" || lastResult.kind === "mc"
        ? currentCard?.cardId
        : null;
    if (!targetCardId) return;
    try {
      const res = await markAnswerCorrect(sessionId, targetCardId);
      setLatestProgress(res.setProgress);
      // Flip the last answer in `answers` from correct=false → true so
      // the round-up recap counts it in the "correct" bucket.
      setAnswers((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last.cardId !== targetCardId) return prev;
        return [
          ...prev.slice(0, -1),
          { ...last, correct: true, graduated: res.graduated },
        ];
      });
      // Update the visible feedback so the UI reflects the override.
      // Keep the diff/similarity fields for written results so the
      // learner can still see what they typed.
      setLastResult((prev) =>
        prev
          ? {
              ...prev,
              correct: true,
              graduated: res.graduated,
              demoted: res.demoted,
            }
          : prev,
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }, [sessionId, lastResult, currentCard]);

  const reQueueCurrent = useCallback(() => {
    if (!currentCard) return;
    // Append a duplicate of the current card to the end of the batch
    // and advance past the original. That way the learner sees a new
    // card next but this one comes back around before the batch ends.
    // Simpler than splicing in place, and keeps batchIndex marching
    // forward monotonically.
    setBatch((prev) => (prev.length === 0 ? prev : [...prev, currentCard]));
    setLastResult(null);
    setStatus("active");
    setBatchIndex((i) => i + 1);
  }, [currentCard]);

  // Batch boundary: we just answered the last card of the current
  // batch AND another batch is coming. The caller uses this to gate
  // the round-up screen — advancing past this state fetches the next
  // batch.
  const atBatchBoundary =
    status === "showing-feedback" &&
    batch.length > 0 &&
    batchIndex >= batch.length - 1 &&
    hasMoreCards;

  const currentBatchAnswers = answers.slice(batchStartAnswerCount);

  return {
    sessionId,
    status,
    error,
    summary,
    currentCard,
    batchIndex,
    batchSize: batch.length,
    totalAnswered: answers.length,
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
  };
}
