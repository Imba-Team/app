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
  startSession,
  submitSessionAnswer,
  submitWrittenAnswer,
  type AnswerResponse,
  type LearnBatchCard,
  type SessionSummary,
  type WrittenAnswerResponse,
} from "@/lib/api";

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
  lastResult: LearnCardResult | null;
  hasMoreCards: boolean;
  submitMc: (input: {
    selectedChoiceIndex: number;
    hintUsed: boolean;
  }) => Promise<void>;
  submitWritten: (input: {
    userAnswer: string;
    hintUsed: boolean;
  }) => Promise<void>;
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
}: UseLearnSessionOptions): UseLearnSessionReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
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

  const startedRef = useRef(false);
  const [attemptKey, setAttemptKey] = useState(0);

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
        const session = await startSession(moduleId, "LEARN");
        const first = await getNextLearnBatch(session.sessionId, batchSize);
        setSessionId(session.sessionId);
        setBatch(first.cards);
        setBatchIndex(0);
        setHasMoreCards(first.hasMoreCards);
        setStatus(first.cards.length > 0 ? "active" : "complete");
      } catch (err) {
        startedRef.current = false;
        setError((err as Error).message);
        setStatus("error");
      }
    })();
  }, [enabled, moduleId, batchSize, attemptKey]);

  const retry = useCallback(() => {
    if (startedRef.current) return;
    setAttemptKey((k) => k + 1);
  }, []);

  const currentCard = batch[batchIndex] ?? null;

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
      const next = await getNextLearnBatch(sessionId, batchSize);
      setBatch(next.cards);
      setBatchIndex(0);
      setHasMoreCards(next.hasMoreCards);
      setStatus(next.cards.length > 0 ? "active" : "active");
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    }
  }, [sessionId, batch.length, batchIndex, hasMoreCards, batchSize]);

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

      try {
        const res = await submitSessionAnswer(sessionId, {
          attemptId,
          cardId: currentCard.cardId,
          studyMode: "LEARN_MC",
          outcome,
          hintUsed,
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
      try {
        const res = await submitWrittenAnswer(sessionId, {
          attemptId,
          cardId: currentCard.cardId,
          studyMode: "LEARN_WRITTEN",
          userAnswer,
          hintUsed,
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
    lastResult,
    hasMoreCards,
    submitMc,
    submitWritten,
    advance,
    finish,
    retry,
  };
}
