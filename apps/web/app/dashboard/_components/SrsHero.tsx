"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertCircle, CheckCircle2, Sparkles, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSrsQueue } from "@/lib/hooks/useSrs";

// The queue endpoint returns *all* due cards up to `limit`; anything
// beyond that we can only surface as an aggregate total. 50 is enough
// to reliably compute the overdue/due/new split for the hero without
// paginating.
const QUEUE_SLICE = 50;

function todayIsoUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SrsHero() {
  const queue = useSrsQueue(QUEUE_SLICE, 0);
  const items = queue.data?.items ?? [];
  const total = queue.data?.total ?? 0;

  // Split the slice into the three chips users care about. If the
  // total exceeds the slice, the chip numbers under-count — we prefer
  // that to a second request just for the label.
  const split = useMemo(() => {
    const today = todayIsoUtc();
    let overdue = 0;
    let due = 0;
    let fresh = 0;
    for (const c of items) {
      if (c.repetitions === 0) fresh += 1;
      else if (c.dueDate < today) overdue += 1;
      else due += 1;
    }
    return { overdue, due, fresh };
  }, [items]);

  if (queue.isLoading) {
    return <Skeleton className="h-40 w-full rounded-2xl bg-gray-100" />;
  }

  if (total === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-full bg-emerald-50 p-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900">
                You&apos;re all caught up.
              </p>
              <p className="truncate text-xs text-gray-500">
                Nothing is due right now.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link href="/library">Study a module</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-linear-to-br from-brand-300 to-brand-600 text-neutral-900">
      <CardContent className="flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-neutral-900/10 p-3">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-900/70">
                Today&apos;s review
              </p>
              <h2 className="text-2xl font-bold sm:text-3xl">
                {total} card{total === 1 ? "" : "s"} due
              </h2>
              <p className="mt-1 text-sm text-neutral-900/80">
                Spaced repetition keeps what you&apos;ve learned from slipping.
              </p>
            </div>
          </div>
          <Button
            asChild
            size="lg"
            className="w-full shrink-0 bg-neutral-900 text-white hover:bg-neutral-800 sm:w-auto"
          >
            <Link href="/srs">Start review →</Link>
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip
            icon={<AlertCircle className="h-3.5 w-3.5" />}
            label="Overdue"
            count={split.overdue}
            tone="urgent"
          />
          <Chip
            icon={<Zap className="h-3.5 w-3.5" />}
            label="Due today"
            count={split.due}
            tone="default"
          />
          <Chip
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label="New"
            count={split.fresh}
            tone="default"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Chip({
  icon,
  label,
  count,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  tone: "default" | "urgent";
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        tone === "urgent" && count > 0
          ? "bg-rose-600/90 text-white"
          : "bg-neutral-900/10 text-neutral-900/80"
      }`}
    >
      {icon}
      <span>{label}</span>
      <span className="font-bold">{count}</span>
    </div>
  );
}
