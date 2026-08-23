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
  attemptId: string;
  cardId: string;
  outcome: AttemptOutcome;
  hintUsed: boolean;
  /**
   * Set to true once the server confirms the card graduated to
   * MASTERED. Starts as `false` and is patched in when the response
   * arrives. Stays `false` if the submission ultimately fails so the
   * "Newly mastered" count doesn't overstate.
   */
  graduated: boolean;
  demoted: boolean;
};

type Status = "idle" | "starting" | "active" | "completing" | "complete" | "error";

interface UseFlashcardSessionOptions {
  moduleId: string;
  /** Enable the effect once the caller has terms loaded — avoids starting an empty session. */
  enabled: boolean;
  /**
   * If provided, resume this existing session instead of creating a new
   * one via POST /sessions. Used when the learner clicks "Resume" on a
   * still-live entry (< 5 min old) in the session history. If the id is
   * stale or wrong (server-side sweep raced the click), the first
   * answer submission will 404 and surface as a normal error.
   */
  resumeSessionId?: string;
  /**
   * Called when an answer submission fails after all retries. The card
   * has already advanced by the time this fires — use it to surface a
   * toast so the learner knows their answer wasn't recorded.
   */
  onSubmitError?: (error: Error) => void;
}

interface UseFlashcardSessionReturn {
  sessionId: string | null;
  status: Status;
  error: string | null;
  summary: SessionSummary | null;
  latestProgress: AnswerResponse["setProgress"] | null;
  answers: AnswerRecord[];
  /**
   * Fire-and-forget: returns immediately so the UI can advance without
   * waiting on the network. Each submit carries an idempotent
   * `attemptId` (TDD §8a.5) so silent retries can't double-score.
   */
  submitAnswer: (input: {
    cardId: string;
    outcome: AttemptOutcome;
    hintUsed: boolean;
  }) => void;
  finish: () => Promise<void>;
  retry: () => void;
  isBusy: boolean;
}

// One retry is enough — the attemptId makes the request idempotent, so
// even if the client bails and reconnects later the server will dedupe.
// Keep backoff short so a truly stalled network doesn't jam the queue.
const SUBMIT_RETRY_DELAYS_MS = [750];

// Cap how long `finish()` waits for the in-flight submission queue to
// drain before firing POST /sessions/:id/complete. The summary
// numbers come from the local `answers` array (client-authoritative),
// so this drain is only about durable server-side counters — it's fine
// to fall through quickly and let queued tasks finish in the
// background.
const FINISH_DRAIN_TIMEOUT_MS = 1500;

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
  resumeSessionId,
  onSubmitError,
}: UseFlashcardSessionOptions): UseFlashcardSessionReturn {
  const [sessionId, setSessionId] = useState<string | null>(
    resumeSessionId ?? null,
  );
  // Seed status from mount-time inputs so the effect below doesn't need
  // to setState synchronously (React Compiler flags that as cascading).
  const [status, setStatus] = useState<Status>(() => {
    if (!enabled) return "idle";
    if (resumeSessionId) return "active";
    return "starting";
  });
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [latestProgress, setLatestProgress] = useState<
    AnswerResponse["setProgress"] | null
  >(null);

  // Local session-start timestamp — the synthesized summary uses this
  // to compute durationSeconds without waiting for the server. Set once
  // when the session becomes active.
  const startedAtRef = useRef<Date | null>(null);

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

    // Resume path: caller handed us a live sessionId (from the history
    // Resume button). Skip POST /sessions entirely; the existing
    // session row on the server is fine to keep using. We don't know
    // the true original startedAt without another round-trip, so
    // approximate with "now" — duration will underreport for resumes,
    // which is fine. Status was already seeded to "active" from the
    // useState initializer above.
    if (resumeSessionId) {
      startedAtRef.current = new Date();
      return;
    }

    startSession(moduleId, "FLASHCARD")
      .then((res) => {
        startedAtRef.current = new Date();
        setSessionId(res.sessionId);
        setStatus("active");
      })
      .catch((err: Error) => {
        // Allow a manual retry.
        startedRef.current = false;
        setError(err.message);
        setStatus("error");
      });
  }, [enabled, moduleId, attemptKey, resumeSessionId]);

  const retry = useCallback(() => {
    if (startedRef.current) return;
    setError(null);
    setStatus("starting");
    setAttemptKey((k) => k + 1);
  }, []);

  // Single-lane submission queue. Every answer submission chains off
  // the previous one so at most one POST /sessions/:id/answer is in
  // flight at a time. This is deliberate: the backend transaction takes
  // row-level write locks on StudySession and UserSetProgress, so N
  // parallel submissions serialize *on the database* and pile up past
  // the 10s axios timeout. Queuing on the client keeps the requests
  // themselves fast and predictable. The UI already advances
  // optimistically, so users don't feel the queue.
  const submitQueueRef = useRef<Promise<void>>(Promise.resolve());
  const onSubmitErrorRef = useRef(onSubmitError);
  useEffect(() => {
    onSubmitErrorRef.current = onSubmitError;
  }, [onSubmitError]);

  const submitAnswer = useCallback(
    (input: {
      cardId: string;
      outcome: AttemptOutcome;
      hintUsed: boolean;
    }): void => {
      if (!sessionId) return;
      const { cardId, outcome, hintUsed } = input;
      // Stable per submission — the server dedupes on this, so retries
      // triggered here or by a later reconnect never double-score.
      // Also used to patch the local answer record when the response
      // eventually arrives.
      const attemptId = newAttemptId();

      // Record the answer locally *before* the network call. This is
      // what the summary screen counts, so stats are correct even if a
      // late submission never round-trips — matching what the learner
      // actually saw and did. Server counters are ground truth for
      // cross-device state but this session's screen doesn't need them.
      setAnswers((prev) => [
        ...prev,
        {
          attemptId,
          cardId,
          outcome,
          hintUsed,
          graduated: false,
          demoted: false,
        },
      ]);

      const next = submitQueueRef.current.then(async () => {
        let lastErr: Error | null = null;
        for (let attempt = 0; attempt <= SUBMIT_RETRY_DELAYS_MS.length; attempt++) {
          try {
            const res = await submitSessionAnswer(sessionId, {
              attemptId,
              cardId,
              studyMode: "FLASHCARD",
              outcome,
              hintUsed,
            });
            setLatestProgress(res.setProgress);
            setAnswers((prev) =>
              prev.map((a) =>
                a.attemptId === attemptId
                  ? { ...a, graduated: res.graduated, demoted: res.demoted }
                  : a,
              ),
            );
            return;
          } catch (err) {
            lastErr = err as Error;
            const delay = SUBMIT_RETRY_DELAYS_MS[attempt];
            if (delay === undefined) break;
            await new Promise((r) => setTimeout(r, delay));
          }
        }
        if (lastErr) {
          onSubmitErrorRef.current?.(lastErr);
        }
      });

      // Swallow rejections here so one bad submission can't poison the
      // whole queue — the inner loop already surfaced the failure via
      // onSubmitError.
      submitQueueRef.current = next.catch(() => undefined);
    },
    [sessionId],
  );

  const finish = useCallback(async () => {
    if (!sessionId || status === "completing" || status === "complete") return;
    setStatus("completing");
    // Wait briefly for in-flight submissions to reach the server so
    // POST /sessions/:id/complete sees fresh counters — but don't
    // block on a stall. Anything still queued keeps running in the
    // background.
    await Promise.race([
      submitQueueRef.current,
      new Promise<void>((r) => setTimeout(r, FINISH_DRAIN_TIMEOUT_MS)),
    ]);

    const startedAt = startedAtRef.current ?? new Date();
    const completedAt = new Date();
    const durationSeconds = Math.max(
      0,
      Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000),
    );

    // Fire completeSession in the background — its return value is
    // just server-side rollups that we already synthesize from local
    // state below. If it fails the session row stays "in progress"
    // server-side; the sweep in listSessions cleans it up after 5 min.
    void completeSession(sessionId).catch(() => undefined);

    // Synthesize the summary from what we know locally. The page then
    // overrides count fields from the `answers` array — this shell
    // just carries mode/timing/ids for the results screen.
    setSummary({
      sessionId,
      studySetId: moduleId,
      mode: "FLASHCARD",
      cardsStudied: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      durationSeconds,
      accuracy: 0,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
    });
    setStatus("complete");
  }, [sessionId, moduleId, status]);

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
