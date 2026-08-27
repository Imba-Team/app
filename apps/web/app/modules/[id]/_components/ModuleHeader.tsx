'use client';

import { Globe, Lock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { buildAssetUrl } from '@/lib/env';
import { cn } from '@/lib/utils';
import type { ModuleInfo } from '../types';

type ModuleHeaderProps = {
  module: ModuleInfo;
};

export default function ModuleHeader({ module }: ModuleHeaderProps) {
  const completedPct =
    module.progress && module.termsCount > 0
      ? Math.round(module.progress.completed * 100)
      : null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold text-neutral-900 sm:text-4xl">
              {module.title}
            </h1>
            {module.description && (
              <p className="mt-3 text-neutral-600">{module.description}</p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Chip tone="brand">
                {module.termsCount} {module.termsCount === 1 ? 'term' : 'terms'}
              </Chip>
              <Chip tone="neutral" icon={module.isPrivate ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}>
                {module.isPrivate ? 'Private' : 'Public'}
              </Chip>
              {completedPct !== null && (
                <Chip tone="emerald">{completedPct}% mastered</Chip>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
            <div className="flex items-center gap-2 sm:flex-row-reverse">
              <Avatar className="size-9">
                <AvatarImage
                  src={buildAssetUrl(module.ownerImg) || ''}
                  alt={module.ownerName}
                  crossOrigin="anonymous"
                />
                <AvatarFallback>{module?.ownerName?.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="text-right sm:text-left">
                <p className="text-[11px] uppercase tracking-wide text-neutral-500">
                  Created by
                </p>
                <p className="text-sm font-medium text-neutral-800">{module.ownerName}</p>
              </div>
            </div>
          </div>
        </div>

        {module.progress && module.termsCount > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-4 text-xs">
              <ProgressLegend
                dot="bg-neutral-300"
                label="Not started"
                value={module.progress.not_started}
              />
              <ProgressLegend
                dot="bg-amber-500"
                label="Learning"
                value={module.progress.in_progress}
              />
              <ProgressLegend
                dot="bg-emerald-500"
                label="Mastered"
                value={module.progress.completed}
              />
            </div>

            <div className="flex h-2 w-full overflow-hidden rounded-full bg-black/5">
              {module.progress.not_started > 0 && (
                <div
                  className="h-full bg-neutral-300"
                  style={{ width: `${module.progress.not_started * 100}%` }}
                />
              )}
              {module.progress.in_progress > 0 && (
                <div
                  className="h-full bg-amber-500"
                  style={{ width: `${module.progress.in_progress * 100}%` }}
                />
              )}
              {module.progress.completed > 0 && (
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${module.progress.completed * 100}%` }}
                />
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Chip({
  tone,
  icon,
  children,
}: {
  tone: 'brand' | 'neutral' | 'emerald';
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const toneClass = {
    brand: 'bg-brand-500/10 text-brand-500',
    neutral: 'bg-neutral-100 text-neutral-600',
    emerald: 'bg-emerald-50 text-emerald-700',
  }[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
        toneClass,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

function ProgressLegend({
  dot,
  label,
  value,
}: {
  dot: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-1.5 text-neutral-600">
      <span className={cn('h-2 w-2 rounded-full', dot)} />
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium text-neutral-800">{Math.round(value * 100)}%</span>
    </div>
  );
}
