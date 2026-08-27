'use client';

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

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  Loader2,
  SkipForward,
  Star,
  Volume2,
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
import { useFlashcardSession } from '@/lib/hooks/useFlashcardSession';
import type { Term } from '@/lib/types/term.type';
import type { AttemptOutcome } from '@/lib/api';
import { toggleTermStar } from '@/lib/api';
import { toast } from 'sonner';

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
  return `${words.slice(0, Math.ceil(words.length / 2)).join(' ')}…`;
}

function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'en-US';
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
  const resumeSessionId = searchParams.get('sessionId') ?? undefined;

  const { data: moduleData, isLoading: moduleLoading } = useModule(moduleId);
  const { data: fetchedTerms = [], isLoading: termsLoading } = useTerms(moduleId);

  const [deck, setDeck] = useState<Term[]>([]);
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const initialisedRef = useRef(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (initialisedRef.current) return;
    if (fetchedTerms.length === 0) return;
    initialisedRef.current = true;
    startTransition(() => {
      setDeck(shuffleArray(fetchedTerms));
      setStarred(new Set(fetchedTerms.filter((t) => t.isStarred).map((t) => t.id)));
    });
  }, [fetchedTerms, startTransition]);

  const filteredDeck = deck;

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hintUsedByCard, setHintUsedByCard] = useState<Record<string, boolean>>({});

  const current = filteredDeck[index];

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
    onSubmitError: useCallback((err: Error) => {
      toast.error(`Couldn't save your answer: ${err.message}`);
    }, []),
  });

  const autoFinishedRef = useRef(false);
  useEffect(() => {
    if (
      sessionId &&
      sessionStatus === 'active' &&
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
    setIndex((i) => Math.min(filteredDeck.length, i + 1));
  }, [filteredDeck.length]);

  // Guard against a rapid re-tap on the same card firing a second submit
  // before React re-renders the advanced state. Idempotent attemptIds
  // would swallow the duplicate server-side, but this avoids the
  // wasted round-trip entirely.
  const lastAnsweredCardRef = useRef<string | null>(null);

  const answer = useCallback(
    (outcome: AttemptOutcome) => {
      if (!current || !sessionId) return;
      if (lastAnsweredCardRef.current === current.id) return;
      lastAnsweredCardRef.current = current.id;
      submitAnswer({
        cardId: current.id,
        outcome,
        hintUsed: !!hintUsedByCard[current.id],
      });
      advance();
    },
    [current, sessionId, hintUsedByCard, submitAnswer, advance],
  );

  const goPrev = useCallback(() => {
    setFlipped(false);
    setShowHint(false);
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setFlipped(false);
    setShowHint(false);
    setIndex((i) => Math.min(filteredDeck.length - 1, i + 1));
  }, [filteredDeck.length]);

  const revealHint = useCallback(() => {
    if (!current) return;
    setShowHint((v) => !v);
    setHintUsedByCard((prev) => (prev[current.id] ? prev : { ...prev, [current.id]: true }));
  }, [current]);

  const toggleStar = useCallback(async () => {
    if (!current) return;
    const next = !starred.has(current.id);
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

  useEffect(() => {
    if (!current || summary) return;
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t as HTMLElement).isContentEditable)
      ) {
        return;
      }
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          setFlipped((v) => !v);
          break;
        case 'ArrowLeft':
          goPrev();
          break;
        case 'ArrowRight':
          goNext();
          break;
        case 'KeyK':
          answer('CORRECT');
          break;
        case 'KeyL':
          answer('INCORRECT');
          break;
        case 'KeyS':
          answer('SKIPPED');
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, summary, answer, goPrev, goNext]);

  const total = filteredDeck.length;

  // ============================================
  // states: loading / empty / complete / active
  // ============================================

  if (moduleLoading || termsLoading) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-3 px-6">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        <p className="text-sm text-neutral-500">Loading flashcards…</p>
      </main>
    );
  }

  if (fetchedTerms.length === 0) {
    return (
      <EmptyState
        title="No terms to study"
        body="This module doesn't have any flashcards yet. Add some terms first."
        primaryLabel="Back to module"
        onPrimary={() => router.push(`/modules/${moduleId}`)}
      />
    );
  }

  if (summary) {
    // Prefer local counts over the server rollup — the server counters
    // only reflect answers whose POST already committed, and a slow
    // network can leave them stale (or zero) by the time we render.
    // The learner sees what they actually did.
    const correctAnswers = answers.filter(
      (a) => a.outcome === 'CORRECT',
    ).length;
    const incorrectAnswers = answers.filter(
      (a) => a.outcome === 'INCORRECT',
    ).length;
    const cardsStudied = answers.filter(
      (a) => a.outcome !== 'SKIPPED',
    ).length;
    const answered = correctAnswers + incorrectAnswers;
    const accuracy = answered === 0 ? 0 : correctAnswers / answered;
    return (
      <SessionResults
        summary={{
          ...summary,
          correctAnswers,
          incorrectAnswers,
          cardsStudied,
          accuracy: Number(accuracy.toFixed(4)),
        }}
        answers={answers}
        moduleId={moduleId}
        modeRoute="flashcards"
        latestProgress={latestProgress}
      />
    );
  }

  if (sessionStatus === 'completing') {
    return <SessionResultsLoading />;
  }

  if (sessionStatus === 'error' && sessionError && sessionId) {
    return <SessionResultsError error={sessionError} onRetry={finish} moduleId={moduleId} />;
  }

  const isSessionEnd = index >= filteredDeck.length;
  if (isSessionEnd) {
    return <SessionResultsLoading />;
  }

  const isStarred = starred.has(current.id);
  const hintUsed = !!hintUsedByCard[current.id];
  const progressPct = total === 0 ? 0 : (index / total) * 100;

  // ============================================
  // main render
  // ============================================

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 px-6 py-8 sm:px-8">
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
            Card {Math.min(index + 1, total)} of {total}
          </p>
          {latestProgress && (
            <p className="text-xs text-neutral-500">
              {latestProgress.masteredCount}/{latestProgress.totalCards} mastered
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5">
        <div
          className="h-full rounded-full bg-brand-400 transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Session-start error banner */}
      {sessionStatus === 'error' && sessionError && (
        <Card className="border border-rose-200 bg-rose-50 py-4">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm text-rose-700">
            <div>
              <p className="font-medium">Couldn&apos;t start the study session.</p>
              <p className="text-rose-600/80">{sessionError}</p>
            </div>
            <Button size="sm" variant="outline" onClick={retry}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={revealHint}
          aria-label="Toggle hint"
          className={cn(
            'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
            hintUsed
              ? 'border-amber-200 bg-amber-50 text-amber-700'
              : 'border-black/10 bg-white text-neutral-700 hover:bg-black/5',
          )}
        >
          <Lightbulb className="h-4 w-4" />
          {showHint ? (
            <span className="font-mono">{getHint(current.definition)}</span>
          ) : (
            <span>Hint</span>
          )}
        </button>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => speak(flipped ? current.definition : current.term)}
            aria-label="Speak"
          >
            <Volume2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleStar}
            aria-label={isStarred ? 'Unstar' : 'Star'}
          >
            <Star
              className={cn(
                'h-5 w-5 transition-colors',
                isStarred ? 'fill-brand-400 text-brand-400' : 'text-neutral-400',
              )}
            />
          </Button>
        </div>
      </div>

      {/* Card */}
      <div className="relative h-[60vh] w-full sm:h-105" style={{ perspective: '1200px' }}>
        <div
          className={cn(
            'relative h-full w-full cursor-pointer transition-transform duration-500',
            flipped && 'rotate-y-180',
          )}
          style={{ transformStyle: 'preserve-3d' }}
          onClick={() => setFlipped((v) => !v)}
        >
          {/* Front */}
          <div
            className="absolute flex h-full w-full flex-col rounded-3xl border border-black/5 bg-white p-6 shadow-lg shadow-black/5"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="flex flex-1 items-center justify-center wrap-break-word p-4 text-center text-3xl font-semibold text-neutral-900 sm:text-4xl">
              {current.term}
            </div>
            <p className="text-center text-xs text-neutral-400">
              Tap or press{' '}
              <kbd className="mx-0.5 rounded border border-black/10 bg-white px-1 font-mono text-neutral-700">
                Space
              </kbd>{' '}
              to flip
            </p>
          </div>

          {/* Back */}
          <div
            className="absolute flex h-full w-full rotate-y-180 flex-col rounded-3xl border border-black/5 bg-white p-6 shadow-lg shadow-black/5"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="flex flex-1 items-center justify-center wrap-break-word p-4 text-center text-2xl leading-relaxed text-neutral-900">
              {current.definition}
            </div>
            <p className="text-center text-xs text-neutral-400">
              Tap or press{' '}
              <kbd className="mx-0.5 rounded border border-black/10 bg-white px-1 font-mono text-neutral-700">
                Space
              </kbd>{' '}
              to flip back
            </p>
          </div>
        </div>
      </div>

      {/* Answer buttons */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Button
          variant="outline"
          size="lg"
          className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          onClick={() => answer('INCORRECT')}
          disabled={!sessionId}
        >
          <XCircle className="h-4 w-4" />
          Still learning
          <kbd className="ml-1 rounded border border-black/10 bg-white px-1 font-mono text-[11px] text-neutral-500">
            L
          </kbd>
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => answer('SKIPPED')}
          disabled={!sessionId}
        >
          <SkipForward className="h-4 w-4" />
          Skip
          <kbd className="ml-1 rounded border border-black/10 bg-white px-1 font-mono text-[11px] text-neutral-500">
            S
          </kbd>
        </Button>
        <Button size="lg" onClick={() => answer('CORRECT')} disabled={!sessionId}>
          <CheckCircle2 className="h-4 w-4" />
          Know it
          <kbd className="ml-1 rounded border border-black/10 bg-white/70 px-1 font-mono text-[11px] text-neutral-700">
            K
          </kbd>
        </Button>
      </div>

      {/* Nav */}
      <div className="flex justify-center gap-3">
        <Button variant="ghost" onClick={goPrev} disabled={index === 0}>
          <ArrowLeft className="h-4 w-4" /> Prev
        </Button>
        <Button variant="ghost" onClick={goNext} disabled={index >= filteredDeck.length - 1}>
          Next <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </main>
  );
}

function EmptyState({
  title,
  body,
  primaryLabel,
  onPrimary,
}: {
  title: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-6 py-12">
      <Card>
        <CardContent className="flex flex-col items-start gap-3">
          <p className="text-lg font-semibold text-neutral-900">{title}</p>
          <p className="text-sm text-neutral-600">{body}</p>
          <Button onClick={onPrimary}>{primaryLabel}</Button>
        </CardContent>
      </Card>
    </main>
  );
}
