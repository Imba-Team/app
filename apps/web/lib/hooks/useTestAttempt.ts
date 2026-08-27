/**
 * Test-mode session hook. Owns the full attempt lifecycle:
 *   idle → starting → active → submitting → complete
 *
 * On mount (when `enabled`) it POSTs /test-attempts to spawn the
 * attempt, then holds the returned questions + answer state in memory
 * until the learner submits. The server is the source of truth for
 * grading — we never grade client-side. On submit we swap `questions`
 * out for the graded `result` so the UI can render the review.
 *
 * Not analogous to useLearnSession's pause/resume: a test is a
 * single-sitting flow. If the learner navigates away we leave the
 * IN_PROGRESS row on the server; the 24-hour sweep cleans it up.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  abandonTestAttempt,
  getTestAttempt,
  startTestAttempt,
  submitTestAttempt,
  type StartTestAttemptResponse,
  type SubmitTestAnswerPayload,
  type TestAttemptResult,
  type TestQuestion,
} from "@/lib/api";

type Status =
  | "idle"
  | "starting"
  | "active"
  | "submitting"
  | "complete"
  | "error";

/**
 * Client-side answer state. One entry per question keyed by
 * questionAttemptId. Only the relevant field for the question's type
 * is populated; the rest stay undefined. Empty string userAnswer /
 * missing selectedChoiceIndex both count as "unanswered" on submit
 * per the server contract.
 */
export interface AnswerState {
  userAnswer?: string;
  selectedChoiceIndex?: number;
  userIsTrue?: boolean;
  /** MATCH — keyed by pairId, value is the chosen candidate flashcardId
   *  (or null for "no pick"). */
  matchingPicks?: Record<string, string | null>;
}

interface UseTestAttemptOptions {
  moduleId: string;
  /** Enabled once the caller knows the module has terms to test on. */
  enabled: boolean;
  /** If provided, hydrate the review of an existing (usually COMPLETED)
   *  attempt instead of starting a new one. Powers the results-review
   *  deep-link. */
  reviewAttemptId?: string;
}

export interface UseTestAttemptReturn {
  status: Status;
  error: string | null;
  attempt: StartTestAttemptResponse | null;
  /** Live question array. During `active` it's the questions the
   *  learner is answering; after `complete` it's null and `result`
   *  carries the graded rows. */
  questions: TestQuestion[];
  result: TestAttemptResult | null;
  currentIndex: number;
  answers: Record<string, AnswerState>;
  /** Wall-clock ms elapsed since the attempt started — ticks each
   *  render for the timer chip. */
  elapsedMs: number;

  /** Move to next question (or noop at the end). */
  goNext: () => void;
  goPrev: () => void;
  goTo: (index: number) => void;

  /** Merge a partial answer for the current question. Client-only —
   *  server sees the full set on submit. */
  setAnswer: (
    questionAttemptId: string,
    patch: Partial<AnswerState>,
  ) => void;

  submit: () => Promise<void>;
  abandon: () => Promise<void>;
  retry: () => void;
}

export function useTestAttempt({
  moduleId,
  enabled,
  reviewAttemptId,
}: UseTestAttemptOptions): UseTestAttemptReturn {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<StartTestAttemptResponse | null>(null);
  const [result, setResult] = useState<TestAttemptResult | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  // Guard against React StrictMode double-invoke: startedRef ensures
  // POST /test-attempts fires exactly once per mount. `attemptKey`
  // increments on retry to force a fresh start.
  const startedRef = useRef(false);
  const [attemptKey, setAttemptKey] = useState(0);
  // When true, the next spawn ignores `reviewAttemptId` and starts a
  // brand-new attempt. Set by retry() so a "Take another test" click
  // from a review deep-link doesn't just re-hydrate the same result.
  const forceFreshRef = useRef(false);

  // Kick off the attempt (or hydrate a review) once enabled.
  useEffect(() => {
    if (!enabled || startedRef.current) return;
    startedRef.current = true;
    setStatus("starting");
    setError(null);
    const skipReview = forceFreshRef.current;
    forceFreshRef.current = false;

    (async () => {
      try {
        if (reviewAttemptId && !skipReview) {
          const reviewed = await getTestAttempt(reviewAttemptId);
          setResult(reviewed);
          setStatus("complete");
          return;
        }
        const started = await startTestAttempt(moduleId);
        setAttempt(started);
        setCurrentIndex(0);
        setAnswers({});
        setStartedAt(Date.now());
        setStatus("active");
      } catch (err) {
        startedRef.current = false;
        setError((err as Error).message);
        setStatus("error");
      }
    })();
  }, [enabled, moduleId, reviewAttemptId, attemptKey]);

  // Timer tick — every second while active. Cheap; unmounts stop it.
  useEffect(() => {
    if (status !== "active") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status]);

  // Memoize the empty-array fallback so downstream deps don't churn
  // on every render before the attempt loads.
  const questions: TestQuestion[] = useMemo(
    () => attempt?.questions ?? [],
    [attempt],
  );
  const elapsedMs = startedAt ? Math.max(0, now - startedAt) : 0;

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(questions.length - 1, index));
      setCurrentIndex(clamped);
    },
    [questions.length],
  );

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(questions.length - 1, i + 1));
  }, [questions.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const setAnswer = useCallback(
    (questionAttemptId: string, patch: Partial<AnswerState>) => {
      setAnswers((prev) => ({
        ...prev,
        [questionAttemptId]: { ...prev[questionAttemptId], ...patch },
      }));
    },
    [],
  );

  const submit = useCallback(async () => {
    if (!attempt || status === "submitting" || status === "complete") return;
    setStatus("submitting");
    try {
      // Marshal in-memory answers into the wire shape. Empty entries
      // are still sent as-is (unanswered) so the server can grade them
      // as incorrect and the grader sees the full question list.
      const payload: SubmitTestAnswerPayload[] = questions.map((q) => {
        const a = answers[q.questionAttemptId] ?? {};
        const base: SubmitTestAnswerPayload = {
          questionAttemptId: q.questionAttemptId,
        };
        if (a.userAnswer !== undefined) base.userAnswer = a.userAnswer;
        if (a.selectedChoiceIndex !== undefined)
          base.selectedChoiceIndex = a.selectedChoiceIndex;
        if (a.userIsTrue !== undefined) base.userIsTrue = a.userIsTrue;
        if (a.matchingPicks && q.matchingPairs) {
          // OpenAPI emits `userMatchedFlashcardId` as `Record<string,
          // never> | null` because the field is `string | null` in
          // Prisma + nullable in Swagger. Cast the whole array at the
          // boundary; the server accepts the real string.
          base.matchingPicks = q.matchingPairs.map((p) => ({
            pairId: p.pairId,
            userMatchedFlashcardId: a.matchingPicks?.[p.pairId] ?? null,
          })) as unknown as SubmitTestAnswerPayload["matchingPicks"];
        }
        return base;
      });
      const graded = await submitTestAttempt(attempt.attemptId, payload);
      setResult(graded);
      setStatus("complete");
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    }
  }, [attempt, questions, answers, status]);

  const abandon = useCallback(async () => {
    if (!attempt) return;
    try {
      await abandonTestAttempt(attempt.attemptId);
    } catch {
      // Non-fatal — the sweep will pick it up.
    }
  }, [attempt]);

  const retry = useCallback(() => {
    if (status === "starting" || status === "submitting") return;
    // Reset local state so a fresh start is clean.
    setAttempt(null);
    setResult(null);
    setAnswers({});
    setCurrentIndex(0);
    setStartedAt(null);
    setError(null);
    startedRef.current = false;
    forceFreshRef.current = true;
    setAttemptKey((k) => k + 1);
  }, [status]);

  // Memoize the returned object so callers with useMemo/useCallback
  // deps don't churn every tick.
  return useMemo(
    () => ({
      status,
      error,
      attempt,
      questions,
      result,
      currentIndex,
      answers,
      elapsedMs,
      goNext,
      goPrev,
      goTo,
      setAnswer,
      submit,
      abandon,
      retry,
    }),
    [
      status,
      error,
      attempt,
      questions,
      result,
      currentIndex,
      answers,
      elapsedMs,
      goNext,
      goPrev,
      goTo,
      setAnswer,
      submit,
      abandon,
      retry,
    ],
  );
}
