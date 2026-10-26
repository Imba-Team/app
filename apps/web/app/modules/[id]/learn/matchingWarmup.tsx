'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { LearnBatchCard } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface WarmupPair {
  /** Card id — a prompt and an answer match when their ids are equal. */
  id: string;
  prompt: string;
  answer: string;
}

const minPairs = 4;
const maxPairs = 6;

/**
 * Pairs for the warm-up, taken from the round's multiple-choice cards —
 * the cards the learner is still recognising. Their correct answer is
 * already in the batch (it's one of the choices), so the step runs fully
 * client-side. Returns [] when there aren't enough cards to be useful.
 */
export function buildWarmupPairs(batch: LearnBatchCard[]): WarmupPair[] {
  const pairs: WarmupPair[] = [];
  const seenPrompts = new Set<string>();
  const seenAnswers = new Set<string>();
  for (const card of batch) {
    if (card.promptType !== 'LEARN_MC' || card.correctChoiceIndex === undefined) continue;
    const answer = card.choices?.[card.correctChoiceIndex];
    // Duplicate texts would make two tiles indistinguishable.
    if (!answer || seenPrompts.has(card.term) || seenAnswers.has(answer)) continue;
    seenPrompts.add(card.term);
    seenAnswers.add(answer);
    pairs.push({ id: card.cardId, prompt: card.term, answer });
    if (pairs.length === maxPairs) break;
  }
  return pairs.length >= minPairs ? pairs : [];
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type Side = 'prompt' | 'answer';

/**
 * "Match the pairs" warm-up at the start of a Learn round (MIM-20).
 * Practice only: nothing is sent to the server, and wrong pairs carry no
 * penalty — they shake and clear so the learner can try again.
 */
export function MatchingWarmup({ pairs, onDone }: { pairs: WarmupPair[]; onDone: () => void }) {
  const [answers] = useState(() => shuffled(pairs));
  const [selected, setSelected] = useState<{ side: Side; id: string } | null>(null);
  const [matched, setMatched] = useState<ReadonlySet<string>>(new Set());
  const [wrong, setWrong] = useState<{ prompt: string; answer: string } | null>(null);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
    },
    [],
  );

  const isComplete = matched.size === pairs.length;

  function pick(side: Side, id: string) {
    if (matched.has(id)) return;
    // First pick, or switching selection within the same column.
    if (!selected || selected.side === side) {
      setSelected(selected?.side === side && selected.id === id ? null : { side, id });
      return;
    }
    const promptId = side === 'prompt' ? id : selected.id;
    const answerId = side === 'answer' ? id : selected.id;
    setSelected(null);
    if (promptId === answerId) {
      setMatched((prev) => new Set(prev).add(promptId));
      return;
    }
    setWrong({ prompt: promptId, answer: answerId });
    if (wrongTimer.current) clearTimeout(wrongTimer.current);
    wrongTimer.current = setTimeout(() => setWrong(null), 450);
  }

  function tile(side: Side, pair: WarmupPair) {
    const isMatched = matched.has(pair.id);
    const isSelected = selected?.side === side && selected.id === pair.id;
    const isWrong = wrong?.[side] === pair.id;
    const text = side === 'prompt' ? pair.prompt : pair.answer;
    return (
      <Button
        key={`${side}-${pair.id}`}
        type="button"
        variant="outline"
        disabled={isMatched}
        aria-pressed={isSelected}
        onClick={() => pick(side, pair.id)}
        className={cn(
          'h-auto min-h-14 w-full justify-start rounded-2xl bg-white px-4 py-3 text-left text-sm whitespace-normal',
          isSelected && 'border-brand-400 ring-2 ring-brand-300/60',
          isWrong && 'animate-shake border-rose-300 bg-rose-50',
          isMatched && 'border-emerald-200 bg-emerald-50 text-emerald-700 disabled:opacity-100',
        )}
      >
        {isMatched && <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />}
        <span className="min-w-0 break-words">{text}</span>
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Warm-up</p>
            <h2 className="text-lg font-semibold text-neutral-900">Match the pairs</h2>
            <p className="text-sm text-neutral-500">
              Practice only — this doesn&apos;t change your progress.
            </p>
          </div>
          {!isComplete && (
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Skip warm-up
            </Button>
          )}
        </div>

        <div
          className="grid grid-cols-2 gap-3"
          role="group"
          aria-label="Match each term to its answer"
        >
          <div className="flex flex-col gap-3">{pairs.map((pair) => tile('prompt', pair))}</div>
          <div className="flex flex-col gap-3">{answers.map((pair) => tile('answer', pair))}</div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-neutral-500" aria-live="polite">
            {isComplete ? 'All matched!' : `${matched.size} of ${pairs.length} matched`}
          </p>
          {isComplete && (
            <Button type="button" onClick={onDone} autoFocus>
              Start the round
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
