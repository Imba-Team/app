'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { SrsRating } from '@/lib/api';
import { useReviewSrsCard, useSrsForecast, useSrsQueue } from '@/lib/hooks/useSrs';
import { ForecastChart } from './_components/ForecastChart';

const RATINGS: { rating: SrsRating; label: string; className: string }[] = [
  {
    rating: 'AGAIN',
    label: 'Again',
    className: 'bg-red-100 text-red-700 hover:bg-red-200',
  },
  {
    rating: 'HARD',
    label: 'Hard',
    className: 'bg-orange-100 text-orange-700 hover:bg-orange-200',
  },
  {
    rating: 'GOOD',
    label: 'Good',
    className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
  },
  {
    rating: 'EASY',
    label: 'Easy',
    className: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
  },
];

export default function SrsPage() {
  const queue = useSrsQueue(50, 0);
  const forecast = useSrsForecast(30);
  const review = useReviewSrsCard();

  const [cursor, setCursor] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const cards = queue.data?.items ?? [];
  const current = cards[cursor];
  const totalDue = queue.data?.total ?? 0;
  const remainingLocal = Math.max(cards.length - cursor, 0);

  const handleRate = async (rating: SrsRating) => {
    if (!current) return;
    try {
      await review.mutateAsync({
        srsCardId: current.id,
        attemptId: crypto.randomUUID(),
        rating,
      });
      setRevealed(false);
      setCursor((c) => c + 1);
    } catch {
      // hook surfaces the toast; keep card in place for retry
    }
  };

  const dueTodayCount = useMemo(
    () => forecast.data?.buckets[0]?.dueCount ?? totalDue,
    [forecast.data, totalDue],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-neutral-700">Spaced Review</h1>
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
          <Button variant="outline" size="sm">
            ← Back to dashboard
          </Button>
        </Link>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Due today</h2>

        {queue.isLoading ? (
          <Skeleton className="h-56 w-full rounded-lg bg-gray-100" />
        ) : cards.length === 0 ? (
          <EmptyQueue />
        ) : cursor >= cards.length ? (
          <SessionDone total={cards.length} onReset={() => setCursor(0)} />
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-6 p-8">
              <div className="w-full text-center">
                <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">
                  {remainingLocal} of {cards.length} remaining · {totalDue} due today
                </p>
                <p className="text-2xl font-semibold text-gray-900">{current.term}</p>
                {current.hint && !revealed && (
                  <p className="mt-2 text-sm text-gray-500">Hint: {current.hint}</p>
                )}
              </div>

              {revealed ? (
                <div className="w-full text-center">
                  <p className="mb-4 text-lg text-gray-800">{current.definition}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {RATINGS.map(({ rating, label, className }) => (
                      <Button
                        key={rating}
                        variant="ghost"
                        disabled={review.isPending}
                        onClick={() => handleRate(rating)}
                        className={className}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <Button onClick={() => setRevealed(true)} className="min-w-40">
                  {review.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Show answer'}
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Forecast – next 30 days</h2>
        {forecast.isLoading ? (
          <Skeleton className="h-32 w-full rounded-lg bg-gray-100" />
        ) : (
          <ForecastChart buckets={forecast.data?.buckets ?? []} />
        )}
        <p className="mt-3 text-xs text-gray-500">
          Overdue cards fold into today. Reviews you complete now push their next-due dates further
          out along this curve.
        </p>
      </section>

      {dueTodayCount === 0 && (
        <p className="mt-6 flex items-center gap-2 text-sm text-gray-500">
          <RotateCcw className="h-4 w-4" />
          Nothing due right now. Cards graduate into this queue as you finish Learn sessions.
        </p>
      )}
    </div>
  );
}

function EmptyQueue() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
        <p className="text-lg font-semibold text-gray-800">Nothing due today.</p>
        <p className="text-sm text-gray-500">
          Cards move into the SRS queue after you master them in a Learn session. Come back tomorrow
          – or graduate more cards now.
        </p>
        <Button asChild variant="default" className="mt-2">
          <Link href="/dashboard">Study a module</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function SessionDone({ total, onReset }: { total: number; onReset: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        <p className="text-lg font-semibold text-gray-800">You&apos;re done for today.</p>
        <p className="text-sm text-gray-500">
          {total} card{total === 1 ? '' : 's'} reviewed. See you tomorrow.
        </p>
        <Button variant="ghost" size="sm" onClick={onReset} className="mt-2">
          Review again
        </Button>
      </CardContent>
    </Card>
  );
}
