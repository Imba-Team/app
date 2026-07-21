/**
 * Flashcard-mode session lifecycle.
 *
 * Wraps the TDD §8a session contract:
 *   POST /sessions                 (mode=FLASHCARD)   → sessionId
 *   POST /sessions/:id/answer      (per card action)  → cardProgress + setProgress
 *   POST /sessions/:id/complete    (on finish)        → SessionSummaryDto
 *
 * Answers carry a client-generated UUID (`attemptId`) so flaky-network
 * retries never double-score — see TDD §8a.5.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  completeSession,
  startSession,
  submitSessionAnswer,
  type AnswerResponse,
  type AttemptOutcome,
  type SessionSummary,
} from "@/lib/api";

export type AnswerRecord = {
  cardId: string;
  outcome: AttemptOutcome;
  hintUsed: boolean;
  graduated: boolean;
  demoted: boolean;
};

type Status = "idle" | "starting" | "active" | "completing" | "complete" | "error";

interface UseFlashcardSessionOptions {
  moduleId: string;
  /** Enable the effect once the caller has terms loaded — avoids starting an empty session. */
  enabled: boolean;
}

interface UseFlashcardSessionReturn {
  sessionId: string | null;
  status: Status;
  error: string | null;
  summary: SessionSummary | null;
  latestProgress: AnswerResponse["setProgress"] | null;
  answers: AnswerRecord[];
  submitAnswer: (input: {
    cardId: string;
    outcome: AttemptOutcome;
    hintUsed: boolean;
  }) => Promise<AnswerResponse | null>;
  finish: () => Promise<void>;
  retry: () => void;
  isBusy: boolean;
}

function newAttemptId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older environments: RFC-4122-ish random hex.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function useFlashcardSession({
  moduleId,
  enabled,
}: UseFlashcardSessionOptions): UseFlashcardSessionReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [latestProgress, setLatestProgress] = useState<
    AnswerResponse["setProgress"] | null
  >(null);

  // Guard against React StrictMode's double-invoke firing two POST /sessions
  // and against the effect re-firing when `enabled` toggles. `startedRef` is
  // component-lifetime, so it survives StrictMode's cleanup+re-invoke.
  //
  // Deliberately no per-run cancellation flag: under StrictMode the setup
  // runs, cleanup runs, then setup re-runs — a `let cancelled` captured in
  // the first setup would be set to true by that first cleanup, and the
  // pending fetch's .then would then skip setSessionId even though the
  // session actually started on the server. React 18 tolerates setState on
  // an unmounted component (silent no-op), so we just let the resolution
  // through.
  const startedRef = useRef(false);
  // `attemptKey` bumps whenever the caller wants to retry a failed start.
  const [attemptKey, setAttemptKey] = useState(0);

  useEffect(() => {
    if (!enabled || startedRef.current) return;
    startedRef.current = true;
    setStatus("starting");
    setError(null);

    startSession(moduleId, "FLASHCARD")
      .then((res) => {
        setSessionId(res.sessionId);
        setStatus("active");
      })
      .catch((err: Error) => {
        // Allow a manual retry.
        startedRef.current = false;
        setError(err.message);
        setStatus("error");
      });
  }, [enabled, moduleId, attemptKey]);

  const retry = useCallback(() => {
    if (startedRef.current) return;
    setAttemptKey((k) => k + 1);
  }, []);

  const submitAnswer = useCallback(
    async ({
      cardId,
      outcome,
      hintUsed,
    }: {
      cardId: string;
      outcome: AttemptOutcome;
      hintUsed: boolean;
    }) => {
      if (!sessionId) return null;
      const attemptId = newAttemptId();
      try {
        const res = await submitSessionAnswer(sessionId, {
          attemptId,
          cardId,
          studyMode: "FLASHCARD",
          outcome,
          hintUsed,
        });
        setLatestProgress(res.setProgress);
        setAnswers((prev) => [
          ...prev,
          {
            cardId,
            outcome,
            hintUsed,
            graduated: res.graduated,
            demoted: res.demoted,
          },
        ]);
        return res;
      } catch (err) {
        setError((err as Error).message);
        return null;
      }
    },
    [sessionId],
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

  const isBusy = useMemo(
    () => status === "starting" || status === "completing",
    [status],
  );

  return {
    sessionId,
    status,
    error,
    summary,
    latestProgress,
    answers,
    submitAnswer,
    finish,
    retry,
    isBusy,
  };
}
