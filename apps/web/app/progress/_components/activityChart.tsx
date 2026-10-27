'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { type ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/chart';
import type { ProgressDay } from '@/lib/api';

import { formatDay, formatMinutes, formatPercent, pluralize } from './progressFormat';

const chartConfig = {
  cardsAnswered: { label: 'Cards answered', color: 'var(--color-brand-400)' },
} satisfies ChartConfig;

/** Cards answered per local day, with accuracy and minutes on hover. */
export function ActivityChart({ activity }: { activity: ProgressDay[] }) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
      <BarChart data={activity} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(date: string) => formatDay(date)}
        />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
        <ChartTooltip
          cursor={{ fill: 'var(--color-brand-300)', fillOpacity: 0.25 }}
          content={({ active, payload }) => {
            const day = payload?.[0]?.payload as ProgressDay | undefined;
            if (!active || !day) return null;
            return <ActivityTooltip day={day} />;
          }}
        />
        <Bar dataKey="cardsAnswered" fill="var(--color-cardsAnswered)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

function ActivityTooltip({ day }: { day: ProgressDay }) {
  const accuracy = day.cardsAnswered > 0 ? day.correct / day.cardsAnswered : null;
  return (
    <div className="grid min-w-36 gap-1 rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-neutral-900">
        {formatDay(day.date, { weekday: 'short' })}
      </p>
      {day.cardsAnswered === 0 && day.minutes === 0 ? (
        <p className="text-neutral-500">No study</p>
      ) : (
        <>
          <p className="text-neutral-600">{pluralize(day.cardsAnswered, 'card')}</p>
          {accuracy !== null && (
            <p className="text-neutral-600">{formatPercent(accuracy)} correct</p>
          )}
          {day.minutes > 0 && (
            <p className="text-neutral-600">{formatMinutes(day.minutes)}</p>
          )}
        </>
      )}
    </div>
  );
}
