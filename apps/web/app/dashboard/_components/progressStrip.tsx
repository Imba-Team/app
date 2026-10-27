'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useMyProgress } from '@/lib/hooks/useProgress';

const weekDays = 7;

/**
 * Small stats row under the SRS hero: streak plus this week's cards and
 * accuracy. Neutral tone on purpose — a fact, not a nudge. Shares the
 * 30-day progress query with DashboardTab, so it never loads separately.
 */
export function ProgressStrip() {
  const { data } = useMyProgress(30);
  if (!data) return null;

  const week = data.activity.slice(-weekDays);
  const cards = week.reduce((sum, d) => sum + d.cardsAnswered, 0);
  const correct = week.reduce((sum, d) => sum + d.correct, 0);

  const stats = [
    {
      label: 'Streak',
      value:
        data.currentStreak > 0
          ? `${data.currentStreak} ${data.currentStreak === 1 ? 'day' : 'days'}`
          : '—',
    },
    { label: 'Cards this week', value: cards.toLocaleString() },
    {
      label: 'Accuracy this week',
      value: cards > 0 ? `${Math.round((correct / cards) * 100)}%` : '—',
    },
  ];

  return (
    <Card className="py-0">
      <CardContent className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <dl className="grid flex-1 grid-cols-3 gap-4">
          {stats.map(({ label, value }) => (
            <div key={label} className="min-w-0">
              <dt className="truncate text-xs text-neutral-500">{label}</dt>
              <dd className="text-lg font-bold text-neutral-900 tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <Button asChild size="sm" variant="ghost" className="self-start sm:self-auto">
          <Link href="/progress">
            View progress
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
