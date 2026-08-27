'use client';

/**
 * Composable filter bar for the module Terms section.
 *
 * Three independent controls collapsed into a single pill container
 * that matches the app Navbar (`h-11 rounded-full border bg-white p-1`
 * with pill children). Left-to-right:
 *   1. Starred-only toggle           (client-visible; passed to server)
 *   2. Sort dropdown                 (field + direction; applied client-side)
 *   3. Mastery-status dropdown       (All / New / Learning / Mastered)
 *
 * The starred + status filters are pushed to the server via
 * `useTerms({starred, status})`; sort is applied client-side since
 * the server returns cards in insertion order with no `sort` param.
 */

import { ChevronDown, ChevronUp, Star } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { MasteryStatus, Term } from '@/lib/api';

export type SortField = 'original' | 'name' | 'progress';
export type SortDir = 'asc' | 'desc';
export type StatusFilter = 'all' | MasteryStatus;

interface TermsFilterBarProps {
  starredOnly: boolean;
  onStarredOnlyChange: (next: boolean) => void;

  sortField: SortField;
  sortDir: SortDir;
  onSortChange: (field: SortField, dir: SortDir) => void;

  status: StatusFilter;
  onStatusChange: (next: StatusFilter) => void;

  className?: string;
}

const sortOptions: { key: SortField; label: string }[] = [
  { key: 'original', label: 'Original order' },
  { key: 'name', label: 'Name' },
  { key: 'progress', label: 'Learning progress' },
];

const sortTriggerLabel: Record<SortField, string> = {
  original: 'Original',
  name: 'Name',
  progress: 'Progress',
};

const statusOptions: {
  key: StatusFilter;
  label: string;
  dot?: string;
}[] = [
  { key: 'all', label: 'All statuses' },
  { key: 'NEW', label: 'New', dot: 'bg-gray-400' },
  { key: 'LEARNING', label: 'Learning', dot: 'bg-amber-500' },
  { key: 'MASTERED', label: 'Mastered', dot: 'bg-emerald-500' },
];

const statusTriggerLabel: Record<StatusFilter, string> = {
  all: 'All',
  NEW: 'New',
  LEARNING: 'Learning',
  MASTERED: 'Mastered',
};

// Progress ordering for client-side sort. Ascending = least-mastered
// first so learners can attack their weakest cards without having to
// flip direction.
const progressRank: Record<Term['status'], number> = {
  not_started: 0,
  in_progress: 1,
  completed: 2,
};

/**
 * Client-side sort applied to the fetched term list. Kept next to the
 * bar so the two stay coupled — adding a new field is one place.
 */
export function sortTerms(terms: Term[], field: SortField, dir: SortDir): Term[] {
  if (field === 'original') {
    return dir === 'asc' ? terms : [...terms].reverse();
  }
  const sorted = [...terms].sort((a, b) => {
    if (field === 'name') {
      return a.term.localeCompare(b.term, undefined, { sensitivity: 'base' });
    }
    // progress
    return progressRank[a.status] - progressRank[b.status];
  });
  return dir === 'asc' ? sorted : sorted.reverse();
}

// Shared pill style for child triggers inside the outer container.
// Matches the Navbar's inner tabs: rounded-full, small text, brand
// tint when a filter is actively applied.
const pillBase =
  'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 data-[state=open]:bg-black/5';
const pillIdle = 'text-neutral-700 hover:bg-black/5';
const pillActive =
  'bg-brand-400/10 text-brand-700 hover:bg-brand-400/15 data-[state=open]:bg-brand-400/15';

export default function TermsFilterBar({
  starredOnly,
  onStarredOnlyChange,
  sortField,
  sortDir,
  onSortChange,
  status,
  onStatusChange,
  className,
}: TermsFilterBarProps) {
  const activeStatus = statusOptions.find((o) => o.key === status)!;
  const DirIcon = sortDir === 'asc' ? ChevronUp : ChevronDown;
  const sortIsDefault = sortField === 'original' && sortDir === 'asc';

  return (
    <div
      role="group"
      aria-label="Term filters"
      className={cn(
        'inline-flex h-11 items-center gap-1 rounded-full border border-black/5 bg-white p-1',
        className,
      )}
    >
      {/* 1. Starred-only toggle */}
      <button
        type="button"
        role="switch"
        aria-checked={starredOnly}
        onClick={() => onStarredOnlyChange(!starredOnly)}
        className={cn(pillBase, starredOnly ? pillActive : pillIdle)}
      >
        <Star
          size={14}
          className={cn(
            'transition-colors',
            starredOnly ? 'fill-brand-400 text-brand-400' : 'text-neutral-400',
          )}
        />
        Starred
      </button>

      <Divider />

      {/* 2. Sort dropdown — clicking the active option toggles direction;
          clicking a different option keeps the current direction. */}
      <DropdownMenu>
        <DropdownMenuTrigger className={cn(pillBase)}>
          <span className="text-neutral-500">Sort</span>
          <span>{sortTriggerLabel[sortField]}</span>
          <DirIcon
            size={14}
            className={sortIsDefault ? 'text-neutral-500' : 'text-brand-600'}
            aria-label={sortDir === 'asc' ? 'Ascending' : 'Descending'}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-52">
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {sortOptions.map((o) => {
            const selected = o.key === sortField;
            const ItemDirIcon = selected && sortDir === 'asc' ? ChevronUp : ChevronDown;
            return (
              <DropdownMenuItem
                key={o.key}
                onSelect={(e) => {
                  // Keep the menu open on repeat clicks of the active
                  // item so learners can flip direction without a
                  // second trip. Radix closes by default on select.
                  if (selected) e.preventDefault();
                  const nextDir: SortDir = selected
                    ? sortDir === 'asc'
                      ? 'desc'
                      : 'asc'
                    : sortDir;
                  onSortChange(o.key, nextDir);
                }}
                className={cn(
                  'flex items-center justify-between',
                  selected &&
                    'bg-brand-400/10 text-brand-700 focus:bg-brand-400/15 focus:text-brand-700',
                )}
              >
                <span>{o.label}</span>
                {selected && <ItemDirIcon size={14} className="text-brand-600" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Divider />

      {/* 3. Mastery-status dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger className={cn(pillBase, status === 'all' ? pillIdle : pillActive)}>
          <span className="text-neutral-500">Status</span>
          {activeStatus.dot && (
            <span aria-hidden className={cn('size-2 rounded-full', activeStatus.dot)} />
          )}
          <span>{statusTriggerLabel[status]}</span>
          <ChevronDown
            size={14}
            className={status === 'all' ? 'text-neutral-500' : 'text-brand-600'}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-48">
          <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {statusOptions.map((o) => {
            const selected = o.key === status;
            return (
              <DropdownMenuItem
                key={o.key}
                onSelect={() => onStatusChange(o.key)}
                className={cn(
                  'flex items-center gap-2',
                  selected &&
                    'bg-brand-400/10 text-brand-700 focus:bg-brand-400/15 focus:text-brand-700',
                )}
              >
                {o.dot ? (
                  <span aria-hidden className={cn('size-2 rounded-full', o.dot)} />
                ) : (
                  <span aria-hidden className="size-2" />
                )}
                <span>{o.label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="h-5 w-px bg-black/10" />;
}
