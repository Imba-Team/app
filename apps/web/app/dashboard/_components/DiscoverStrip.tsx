'use client';

import Link from 'next/link';
import { ArrowRight, Compass, Eye } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Module } from '@/lib/api';
import { usePopularPublicSets } from '@/lib/hooks/useModules';
import { Button } from '@/components/ui/button';

// 3×2 grid = 6 cells. The last cell is always the "Discover more" CTA,
// so we render at most 5 popular sets in the leading positions.
const GridCells = 6;
const SetSlots = GridCells - 1;

export function DiscoverStrip() {
  const popular = usePopularPublicSets(SetSlots);
  const items = popular.data ?? [];

  if (popular.isLoading) {
    return (
      <SectionShell>
        <Grid>
          {Array.from({ length: GridCells }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg bg-gray-100" />
          ))}
        </Grid>
      </SectionShell>
    );
  }

  if (items.length === 0) return null;

  return (
    <SectionShell>
      <Grid>
        {items.slice(0, SetSlots).map((m) => (
          <DiscoverCard key={m.id} set={m} />
        ))}
        <DiscoverCTA />
      </Grid>
    </SectionShell>
  );
}

function SectionShell({ children }: { children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-bold text-neutral-700">Popular on Mimir</h2>
        <Link
          href="/discover"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-500"
        >
          <Button size="sm" variant="outline">
            Discover more <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function DiscoverCard({ set }: { set: Module }) {
  return (
    <Link href={`/modules/${set.id}`} className="group block">
      <Card className="h-full">
        <CardContent className="flex h-full flex-col justify-between gap-2 p-4">
          <div>
            <p className="line-clamp-2 text-sm font-semibold text-gray-900">{set.title}</p>
            {set.ownerName && (
              <p className="mt-0.5 truncate text-[11px] text-gray-500">by {set.ownerName}</p>
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] text-gray-500">
            <span>{set.flashcardsCount ?? 0} cards</span>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {set.viewCount ?? 0}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function DiscoverCTA() {
  return (
    <Link href="/discover" className="group block">
      <Card className="h-full bg-brand-500/5 transition group-hover:bg-brand-500/10">
        <CardContent className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
          <div className="rounded-full bg-brand-500/10 p-2 text-brand-500">
            <Compass className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-brand-500">Discover more</p>
          <p className="text-[11px] text-gray-500">Browse the full community catalog</p>
        </CardContent>
      </Card>
    </Link>
  );
}
