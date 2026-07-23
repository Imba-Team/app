"use client";

/**
 * Flashcard Mode — TDD Sprint 5 / §11.3.
 *
 * Full-screen single-card view with a 3D flip animation. The learner
 * self-reports each card with "Know It" (CORRECT) or "Still Learning"
 * (INCORRECT); "Skip" (SKIPPED) is available for anything they want to
 * defer. Each answer submits a CardAttemptEvent to the session so the
 * mastery engine can update UserCardProgress + UserSetProgress in one
 * transaction, and returns the fresh set-progress rollup for the header.
 *
 * Behaviour vs. TDD:
 *   - Client controls order (shuffle on mount, only-starred filter).
 *   - `hintUsed` is set to true the moment the learner peeks (Lightbulb)
 *     — the flag stays true for that card's next answer, per §8a.3.
 *   - Star toggle hits PUT /flashcards/:id/star; it does not affect
 *     scheduling (§8a.10 — mode weights are the only mastery signal).
 *   - On finish we call POST /sessions/:id/complete and render the
 *     summary. No further mutations after that.
 *   - Keyboard shortcuts: Space = flip, ←/→ = prev/next, K = Know it,
 *     L = Still learning, S = Skip.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  SkipForward,
  Star,
  Volume2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TermFilterPills, {
  toServerFilter,
  type TermFilterKey,
} from "@/components/TermFilterPills";
import SessionResults, {
  SessionResultsError,
  SessionResultsLoading,
} from "../_components/SessionResults";
import { useModule } from "@/lib/hooks/useModules";
import { useTerms } from "@/lib/hooks/useTerms";
import { useFlashcardSession } from "@/lib/hooks/useFlashcardSession";
import type { Term } from "@/lib/types/term.type";
import type { AttemptOutcome } from "@/lib/api";
import { toggleTermStar } from "@/lib/api";
import { toast } from "sonner";

// ============================================
// helpers
// ============================================

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getHint(term: string): string {
  const words = term.trim().split(/\s+/);
  if (words.length === 1) {
    const w = words[0];
    return w.length <= 4 ? `${w[0]}…` : `${w.slice(0, 3)}…`;
  }
  return `${words.slice(0, Math.ceil(words.length / 2)).join(" ")}…`;
}

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}

// ============================================
// component
// ============================================

export default function FlashcardsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const moduleId = params.id as string;
  // Optional resume — set when the learner clicked "Resume" on a
  // still-live session in history. See useFlashcardSession for how
  // this bypasses the POST /sessions call.
  const resumeSessionId = searchParams.get("sessionId") ?? undefined;

  const { data: moduleData, isLoading: moduleLoading } = useModule(moduleId);
  const [filter, setFilter] = useState<TermFilterKey>("all");
  // Server-side filter: the pill selection is translated to
  // `?starred=` / `?status=`. React Query keeps the previous result
  // on-screen while the new filter variant loads.
  const { data: fetchedTerms = [], isLoading: termsLoading } = useTerms(
    moduleId,
    toServerFilter(filter),
  );

  // Deck is shuffled from the filter-scoped fetched list. Re-shuffle
  // whenever the filter changes (identity of fetchedTerms changes with
  // the query key), otherwise stay stable across incidental refetches.
  const [deck, setDeck] = useState<Term[]>([]);
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const lastFilterRef = useRef<TermFilterKey | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (fetchedTerms.length === 0) {
      // Filter to zero — clear the deck so we hit the empty-state path
      // instead of showing stale cards from the previous filter.
      if (lastFilterRef.current !== filter) {
        lastFilterRef.current = filter;
        setDeck([]);
        setStarred(new Set());
      }
      return;
    }
    const filterFlipped = lastFilterRef.current !== filter;
    const uninitialised = lastFilterRef.current === null;
    if (filterFlipped || uninitialised) {
      lastFilterRef.current = filter;
      startTransition(() => {
        setDeck(shuffleArray(fetchedTerms));
        setStarred(
          new Set(fetchedTerms.filter((t) => t.isStarred).map((t) => t.id)),
        );
      });
    }
  }, [fetchedTerms, filter, startTransition]);

  // No client-side filter — the deck is already scoped by the server.
  const filteredDeck = deck;

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  // Per-card hint tracker: once the learner peeks, it stays true until they
  // move on. Answered cards inherit the flag they had at answer time.
  const [hintUsedByCard, setHintUsedByCard] = useState<Record<string, boolean>>(
    {},
  );
  const [pendingOutcome, setPendingOutcome] = useState<AttemptOutcome | null>(
    null,
  );

  // Reset card-local UI when filter changes.
  useEffect(() => {
    startTransition(() => {
      setIndex(0);
      setFlipped(false);
      setShowHint(false);
    });
  }, [filter, startTransition]);

  const current = filteredDeck[index];

  // Session lifecycle. `enabled` gates it until we have at least one card.
  const {
    sessionId,
    status: sessionStatus,
    error: sessionError,
    summary,
    latestProgress,
    answers,
    submitAnswer,
    finish,
    retry,
  } = useFlashcardSession({
    moduleId,
    enabled: !moduleLoading && !termsLoading && fetchedTerms.length > 0,
    resumeSessionId,
  });

  // Auto-finish when the learner runs out of cards. Guarded by a ref
  // so React StrictMode's dev-only double-invoke and any late renders
  // during the completing→complete transition don't refire finish().
  const autoFinishedRef = useRef(false);
  useEffect(() => {
    if (
      sessionId &&
      sessionStatus === "active" &&
      deck.length > 0 &&
      index >= deck.length &&
      !summary &&
      !autoFinishedRef.current
    ) {
      autoFinishedRef.current = true;
      void finish();
    }
  }, [sessionId, sessionStatus, deck.length, index, summary, finish]);

  const advance = useCallback(() => {
    setFlipped(false);
    setShowHint(false);
    setPendingOutcome(null);
    setIndex((i) => Math.min(filteredDeck.length, i + 1));
  }, [filteredDeck.length]);

  const answer = useCallback(
    async (outcome: AttemptOutcome) => {
      if (!current || !sessionId || pendingOutcome) return;
      setPendingOutcome(outcome);
      await submitAnswer({
        cardId: current.id,
        outcome,
        hintUsed: !!hintUsedByCard[current.id],
      });
      // Move to the next card even if the request failed — surface the
      // error via toast but don't wedge the flow. Toast is triggered by
      // the hook's error state below.
      advance();
    },
    [current, sessionId, pendingOutcome, hintUsedByCard, submitAnswer, advance],
  );

  const goPrev = useCallback(() => {
    setFlipped(false);
    setShowHint(false);
    setPendingOutcome(null);
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setFlipped(false);
    setShowHint(false);
    setPendingOutcome(null);
    setIndex((i) => Math.min(filteredDeck.length - 1, i + 1));
  }, [filteredDeck.length]);

  const revealHint = useCallback(() => {
    if (!current) return;
    setShowHint((v) => !v);
    setHintUsedByCard((prev) =>
      prev[current.id] ? prev : { ...prev, [current.id]: true },
    );
  }, [current]);

  const toggleStar = useCallback(async () => {
    if (!current) return;
    const next = !starred.has(current.id);
    // Optimistic — flip immediately, revert on failure.
    setStarred((prev) => {
      const s = new Set(prev);
      if (next) s.add(current.id);
      else s.delete(current.id);
      return s;
    });
    try {
      await toggleTermStar(current.id, next);
    } catch (err) {
      setStarred((prev) => {
        const s = new Set(prev);
        if (next) s.delete(current.id);
        else s.add(current.id);
        return s;
      });
      toast.error((err as Error).message);
    }
  }, [current, starred]);

  // Keyboard shortcuts.
  useEffect(() => {
    if (!current || summary) return;
    const handler = (e: KeyboardEvent) => {
      // Ignore when focused inside an input.
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          (t as HTMLElement).isContentEditable)
      ) {
        return;
      }
      switch (e.code) {
        case "Space":
          e.preventDefault();
          setFlipped((v) => !v);
          break;
        case "ArrowLeft":
          goPrev();
          break;
        case "ArrowRight":
          goNext();
          break;
        case "KeyK":
          answer("CORRECT");
          break;
        case "KeyL":
          answer("INCORRECT");
          break;
        case "KeyS":
          answer("SKIPPED");
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current, summary, answer, goPrev, goNext]);

  const total = filteredDeck.length;
  const answeredCount = answers.length;
  const graduatedInSession = answers.filter((a) => a.graduated).length;

  // ============================================
  // states: loading / empty / complete / active
  // ============================================

  if (moduleLoading || termsLoading) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Loading flashcards…</p>
      </main>
    );
  }

  if (fetchedTerms.length === 0) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle>No terms to study</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              This module doesn&apos;t have any flashcards yet. Add some terms
              first.
            </p>
            <Button onClick={() => router.push(`/modules/${moduleId}`)}>
              Back to module
            </Button>
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
        modeRoute="flashcards"
        latestProgress={latestProgress}
      />
    );
  }

  // Session finish is in flight — server call already fired below via
  // the auto-finish effect. Hold the completion loader instead of
  // flashing the intermediate deck-done panel.
  if (sessionStatus === "completing") {
    return <SessionResultsLoading />;
  }

  if (sessionStatus === "error" && sessionError && sessionId) {
    // Session start error is caught earlier as a banner over the deck;
    // this branch is specifically when finish() failed after we ran
    // out of cards.
    return (
      <SessionResultsError
        error={sessionError}
        onRetry={finish}
        moduleId={moduleId}
      />
    );
  }

  // Order matters. An empty filtered deck is NOT a completed session —
  // otherwise "only starred" with no starred cards jumps straight to the
  // end panel. Handle that first.
  if (filteredDeck.length === 0) {
    const emptyLabel =
      filter === "starred"
        ? "No starred cards"
        : filter === "new"
          ? "No new cards"
          : filter === "in_progress"
            ? "No cards you're still learning"
            : filter === "mastered"
              ? "No mastered cards yet"
              : "No cards in this bucket";
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle>{emptyLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setFilter("all")}>
              Show all cards
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Deck exhausted. Auto-finish takes over via the effect below and
  // routes to the SessionResults screen once the summary lands. Show
  // the completion loader in the meantime.
  const isSessionEnd = index >= filteredDeck.length;
  if (isSessionEnd) {
    return <SessionResultsLoading />;
  }

  const isStarred = starred.has(current.id);
  const hintUsed = !!hintUsedByCard[current.id];

  // ============================================
  // main render
  // ============================================

  return (
    <main className="min-h-screen bg-gray-100 overflow-x-hidden">
      {/* Header */}
      <div className="max-w-4xl mx-auto pt-8 px-6">
        <div className="flex items-center justify-between gap-4">
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
              Card {Math.min(index + 1, total)} of {total}
            </p>
            {latestProgress && (
              <p className="text-xs text-gray-400">
                {latestProgress.masteredCount}/{latestProgress.totalCards}{" "}
                mastered
              </p>
            )}
          </div>
        </div>

        {/* Filter — mutually-exclusive pill row across mastery buckets +
            starred. Changing the filter forces a new session-scope of
            cards (server re-fetch) and a fresh shuffle. */}
        <div className="mt-4 flex justify-end">
          <TermFilterPills value={filter} onChange={setFilter} />
        </div>

        {/* Session-start error banner. Buttons are disabled until we have a
            session id, so if the start failed the learner needs a visible
            retry affordance — otherwise the whole screen looks frozen. */}
        {sessionStatus === "error" && sessionError && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">Couldn&apos;t start the study session.</p>
              <p className="text-rose-600/80">{sessionError}</p>
            </div>
            <Button size="sm" variant="outline" onClick={retry}>
              Retry
            </Button>
          </div>
        )}
      </div>

      {/* Card */}
      <div className="flex flex-col items-center justify-start p-6 mt-4">
        {/* Toolbar — sits above the flippable card so its buttons never
            fight the flip-on-click behaviour. Star and Hint would otherwise
            be nested inside the click surface and, even with
            stopPropagation, would flip the card in some pointer scenarios
            (touch, contextmenu). Keeping them outside is unambiguous. */}
        <div className="w-full max-w-[680px] mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={revealHint}
            aria-label="Toggle hint"
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm border transition-colors ${
              hintUsed
                ? "text-amber-600 border-amber-300 bg-amber-50"
                : "text-gray-500 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <Lightbulb size={16} />
            {showHint ? (
              <span className="font-mono">{getHint(current.definition)}</span>
            ) : (
              <span>Hint</span>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => speak(flipped ? current.definition : current.term)}
              className="p-2 rounded-full text-gray-500 hover:bg-gray-100"
              aria-label="Speak"
            >
              <Volume2 size={18} />
            </button>
            <button
              type="button"
              onClick={toggleStar}
              className="p-2 rounded-full hover:bg-gray-100"
              aria-label={isStarred ? "Unstar" : "Star"}
            >
              <Star
                size={20}
                className={
                  isStarred
                    ? "text-yellow-400 fill-yellow-400"
                    : "text-gray-400"
                }
              />
            </button>
          </div>
        </div>

        <div
          className="relative w-full max-w-[680px] h-[60vh] sm:h-[420px]"
          style={{ perspective: "1200px" }}
        >
          <div
            className={`relative w-full h-full transition-transform duration-500 cursor-pointer ${
              flipped ? "rotate-y-180" : ""
            }`}
            style={{ transformStyle: "preserve-3d" }}
            onClick={() => setFlipped((v) => !v)}
          >
            {/* Front */}
            <div
              className="absolute w-full h-full bg-white rounded-3xl shadow-lg flex flex-col p-6"
              style={{ backfaceVisibility: "hidden" }}
            >
              <div className="flex-1 flex items-center justify-center text-4xl font-semibold text-center p-4 break-words">
                {current.term}
              </div>
              <p className="text-xs text-gray-400 text-center">
                Tap or press Space to flip
              </p>
            </div>

            {/* Back */}
            <div
              className="absolute w-full h-full bg-white rounded-3xl shadow-lg flex flex-col p-6 rotate-y-180"
              style={{ backfaceVisibility: "hidden" }}
            >
              <div className="flex-1 flex items-center justify-center text-2xl text-center p-4 leading-relaxed break-words">
                {current.definition}
              </div>
              <p className="text-xs text-gray-400 text-center">
                Tap or press Space to flip back
              </p>
            </div>
          </div>
        </div>

        {/* Answer buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8 w-full max-w-[680px]">
          <Button
            variant="outline"
            className="h-12 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-full"
            onClick={() => answer("INCORRECT")}
            disabled={!sessionId || pendingOutcome !== null}
          >
            <XCircle size={18} className="mr-2" />
            Still learning{" "}
            <span className="ml-2 text-xs text-gray-400">(L)</span>
          </Button>
          <Button
            variant="outline"
            className="h-12 rounded-full"
            onClick={() => answer("SKIPPED")}
            disabled={!sessionId || pendingOutcome !== null}
          >
            <SkipForward size={18} className="mr-2" />
            Skip <span className="ml-2 text-xs text-gray-400">(S)</span>
          </Button>
          <Button
            className="h-12 bg-emerald-600 hover:bg-emerald-700 rounded-full"
            onClick={() => answer("CORRECT")}
            disabled={!sessionId || pendingOutcome !== null}
          >
            <CheckCircle2 size={18} className="mr-2" />
            Know it <span className="ml-2 text-xs text-white/70">(K)</span>
          </Button>
        </div>

        {/* Nav — review previous / next w/o answering */}
        <div className="flex gap-3 mt-4">
          <Button variant="ghost" onClick={goPrev} disabled={index === 0}>
            <ArrowLeft size={16} className="mr-1" /> Prev
          </Button>
          <Button
            variant="ghost"
            onClick={goNext}
            disabled={index >= filteredDeck.length - 1}
          >
            Next <ArrowRight size={16} className="ml-1" />
          </Button>
        </div>
      </div>
    </main>
  );
}

