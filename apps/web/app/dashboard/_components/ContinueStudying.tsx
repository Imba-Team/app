'use client';

import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { RecentStudySet } from '@/lib/api';
import { useRecentStudiedSets } from '@/lib/hooks/useModules';
import { Button } from '@/components/ui/button';

export function ContinueStudying() {
  const recent = useRecentStudiedSets(3);

  if (recent.isLoading) {
    return (
      <SectionShell title="Continue studying">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg bg-gray-100" />
          ))}
        </div>
      </SectionShell>
    );
  }

  const items = recent.data ?? [];
  if (items.length === 0) return null;

  return (
    <SectionShell title="Continue studying">
      <div className="flex flex-col gap-3">
        {items.map((s) => (
          <RecentSetCard key={s.id} set={s} />
        ))}
      </div>
    </SectionShell>
  );
}

function SectionShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-bold text-neutral-700">{title}</h2>
      {children}
    </section>
  );
}

function RecentSetCard({ set }: { set: RecentStudySet }) {
  const total = set.progress?.totalCards ?? set.flashcardsCount ?? 0;
  const mastered = set.progress?.masteredCount ?? 0;
  const learning = set.progress?.learningCount ?? 0;
  const fresh = set.progress?.newCount ?? total;

  const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;

  return (
    <Link href={`/modules/${set.id}`} className="group block">
      <Card>
        <CardContent className="flex items-center gap-">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-neutral-700">{set.title}</p>
            {set.lastStudiedAt && (
              <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-gray-500">
                <Clock className="h-3 w-3" /> {formatRelative(set.lastStudiedAt)}
              </p>
            )}
          </div>

          <div className="hidden w-56 shrink-0 space-y-1.5 sm:block">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>{mastered} mastered</span>
              <span>{learning} learning</span>
              <span>{fresh} new</span>
            </div>
          </div>

          <Button variant="outline" size="sm" className="ml-6">
            Resume <ArrowRight className="h-3 w-3" />
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}

// Small relative-time formatter — the dashboard shows lots of these
// and full Intl.RelativeTimeFormat + locale detection is overkill for
// four card labels. Bring in date-fns if this needs to grow.
function formatRelative(iso: Date | string): string {
  const then = typeof iso === 'string' ? new Date(iso) : iso;
  const diffMs = Date.now() - then.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 4) return `${wk}w ago`;
  return then.toLocaleDateString();
}
