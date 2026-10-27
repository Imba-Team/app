'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { MasteryPoint } from '@/lib/api';

import { formatDay } from './progressFormat';

// Stack order bottom → top: mastered, learning, new.
const chartConfig = {
  masteredCount: { label: 'Mastered', color: 'var(--color-brand-500)' },
  learningCount: { label: 'Learning', color: 'var(--color-brand-300)' },
  newCount: { label: 'New', color: '#d4d4d4' },
} satisfies ChartConfig;

const series = ['masteredCount', 'learningCount', 'newCount'] as const;

/** Cards per mastery status over time, from the nightly snapshots. */
export function MasteryChart({ mastery }: { mastery: MasteryPoint[] }) {
  if (mastery.length < 2) {
    const today = mastery[0];
    return (
      <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
        {today && (
          <p className="text-sm text-neutral-700">
            Today: <strong>{today.masteredCount}</strong> mastered ·{' '}
            <strong>{today.learningCount}</strong> learning · <strong>{today.newCount}</strong> new
          </p>
        )}
        <p className="max-w-xs text-sm text-neutral-500">
          Your mastery history starts today. Check back tomorrow to see it grow.
        </p>
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
      <AreaChart data={mastery} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
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
          content={
            <ChartTooltipContent
              indicator="dot"
              labelFormatter={(_, payload) => {
                const date = (payload?.[0]?.payload as MasteryPoint | undefined)?.date;
                return date ? formatDay(date, { weekday: 'short' }) : null;
              }}
            />
          }
        />
        {series.map((key) => (
          <Area
            key={key}
            dataKey={key}
            type="monotone"
            stackId="mastery"
            fill={`var(--color-${key})`}
            stroke={`var(--color-${key})`}
            fillOpacity={0.7}
          />
        ))}
        <ChartLegend content={<ChartLegendContent />} />
      </AreaChart>
    </ChartContainer>
  );
}
