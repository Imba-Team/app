'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BarChart3 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ProgressRange } from '@/lib/api';
import { useMyProgress } from '@/lib/hooks/useProgress';
import { cn } from '@/lib/utils';

import { ActivityChart } from './_components/activityChart';
import { MasteryChart } from './_components/masteryChart';
import { RetentionChart } from './_components/retentionChart';
import { StreakSummary } from './_components/streakSummary';

export function ProgressPageClient() {
  const [range, setRange] = useState<ProgressRange>(30);
  const progress = useMyProgress(range);
  const data = progress.data;
  // Never answered anything, ever: nothing to chart yet.
  const isEmpty = !!data && data.bestStreak === 0 && data.mastery.length === 0;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-700">Progress</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Your study activity, counted in your local days.
          </p>
        </div>
        {!isEmpty && (
          <Tabs value={String(range)} onValueChange={(v) => setRange(Number(v) as ProgressRange)}>
            <TabsList aria-label="Time range">
              <TabsTrigger value="30">30 days</TabsTrigger>
              <TabsTrigger value="90">90 days</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {progress.isError && !data ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="font-semibold text-neutral-900">Couldn&apos;t load your progress.</p>
            <Button size="sm" variant="outline" onClick={() => progress.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : !data ? (
        <Skeleton aria-busy="true" className="h-[520px] w-full rounded-3xl bg-neutral-200/70" />
      ) : isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="rounded-full bg-brand-300/40 p-3 text-brand-600">
              <BarChart3 className="h-6 w-6" aria-hidden />
            </div>
            <p className="text-lg font-semibold text-neutral-900">No study activity yet</p>
            <p className="max-w-sm text-sm text-neutral-500">
              Answer a few cards in any mode and your streak, activity and mastery will show up
              here.
            </p>
            <Button asChild size="sm" className="mt-2">
              <Link href="/library">
                Start studying
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div
          className={cn(
            'flex flex-col gap-8 transition-opacity',
            progress.isPlaceholderData && 'opacity-60',
          )}
        >
          <StreakSummary progress={data} />

          <ProgressSection title="Activity" caption="Cards answered per day, in every mode.">
            <ActivityChart activity={data.activity} />
          </ProgressSection>

          <div className="grid gap-8 lg:grid-cols-2">
            <ProgressSection title="Mastery over time" caption="Cards by status, summed across your sets.">
              <MasteryChart mastery={data.mastery} />
            </ProgressSection>
            <ProgressSection
              title="Retention"
              caption="How often you remembered a card when it came back."
            >
              <RetentionChart retention={data.retention} />
            </ProgressSection>
          </div>
        </div>
      )}
    </main>
  );
}

function ProgressSection({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold text-neutral-800">{title}</h2>
        <p className="text-xs text-neutral-500">{caption}</p>
      </div>
      <Card className="py-0">
        <CardContent className="p-4 sm:p-5">{children}</CardContent>
      </Card>
    </section>
  );
}
