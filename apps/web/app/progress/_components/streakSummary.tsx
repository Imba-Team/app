import { CalendarCheck, Clock, Layers, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import type { MyProgress } from '@/lib/api';

import { formatMinutes, formatPercent, pluralize } from './progressFormat';

interface Stat {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}

/**
 * Headline numbers. Kept deliberately neutral: the streak is a fact
 * ("5 days in a row"), never a warning about losing it.
 */
export function StreakSummary({ progress }: { progress: MyProgress }) {
  const { currentStreak, bestStreak, studiedToday, totals, days } = progress;

  const stats: Stat[] = [
    {
      icon: CalendarCheck,
      label: 'Current streak',
      value: currentStreak > 0 ? pluralize(currentStreak, 'day') : 'No streak',
      detail:
        currentStreak > 0
          ? studiedToday
            ? 'in a row, including today'
            : 'in a row, up to yesterday'
          : 'Any answer counts as a study day',
    },
    {
      icon: Trophy,
      label: 'Best streak',
      value: pluralize(bestStreak, 'day'),
      detail: 'your longest run so far',
    },
    {
      icon: Layers,
      label: 'Cards answered',
      value: totals.cardsAnswered.toLocaleString(),
      detail: `${formatPercent(totals.accuracy)} correct · last ${days} days`,
    },
    {
      icon: Clock,
      label: 'Time studied',
      value: formatMinutes(totals.minutes),
      detail: `completed sessions · last ${days} days`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map(({ icon: Icon, label, value, detail }) => (
        <Card key={label} className="py-0">
          <CardContent className="flex flex-col gap-1 p-4 sm:p-5">
            <div className="flex items-center gap-2 text-neutral-500">
              <Icon className="h-4 w-4 text-brand-500" aria-hidden />
              <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
            </div>
            <p className="text-2xl font-bold text-neutral-900 tabular-nums">{value}</p>
            <p className="text-xs text-neutral-500">{detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
