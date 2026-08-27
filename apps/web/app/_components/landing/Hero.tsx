'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles, Check, X, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';

export default function Hero() {
  const { isAuthenticated, isLoading } = useAuth();

  const primaryHref = isLoading ? '#' : isAuthenticated ? '/dashboard' : '/register';
  const primaryLabel = isLoading
    ? 'Loading…'
    : isAuthenticated
      ? 'Continue to dashboard'
      : 'Get started free';

  return (
    <section id="about" className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
      <div className="flex flex-col items-start gap-6">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-500">
          <Sparkles className="h-3.5 w-3.5" />
          Spaced repetition, done right
        </span>

        <h1 className="text-4xl font-bold leading-tight text-neutral-900 sm:text-5xl lg:text-6xl">
          Master anything with <span className="text-brand-400">smart spaced repetition</span>
        </h1>

        <p className="max-w-xl text-lg text-neutral-600">
          Mimir schedules your reviews at the exact moment you&apos;re about to forget — backed by
          the SM-2 algorithm and a mastery engine that tracks real progress.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          {isLoading ? (
            <Skeleton className="h-12 w-44 rounded-full" />
          ) : (
            <Button asChild size="lg">
              <Link href={primaryHref}>
                {primaryLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
          {!isAuthenticated && !isLoading && (
            <Button asChild variant="secondary" size="lg">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="relative">
        <HeroReviewCard />
      </div>
    </section>
  );
}

function HeroReviewCard() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[2rem] bg-linear-to-br from-brand-300/25 to-brand-500/15 blur-2xl"
      />
      <Card className="border border-black/5 shadow-lg shadow-black/5">
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-2.5 py-0.5 text-[11px] font-medium text-brand-500">
              <RotateCcw className="h-3 w-3" />
              Review card
            </span>
            <span className="text-[11px] font-medium text-neutral-500">3 of 24</span>
          </div>

          <div className="flex flex-col gap-2 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Term</p>
            <p className="text-2xl font-bold text-neutral-900">Ephemeral</p>
            <p className="mt-3 text-sm text-neutral-600">Lasting for a very short time.</p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              How well did you know it?
            </p>
            <div className="grid grid-cols-3 gap-2">
              <RatingButton tone="rose" icon={<X className="h-3.5 w-3.5" />} label="Again" />
              <RatingButton tone="amber" label="Hard" />
              <RatingButton tone="emerald" icon={<Check className="h-3.5 w-3.5" />} label="Good" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RatingButton({
  tone,
  icon,
  label,
}: {
  tone: 'rose' | 'amber' | 'emerald';
  icon?: React.ReactNode;
  label: string;
}) {
  const toneClass = {
    rose: 'bg-rose-50 text-rose-600',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-600',
  }[tone];
  return (
    <div
      className={`inline-flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold ${toneClass}`}
    >
      {icon}
      {label}
    </div>
  );
}
