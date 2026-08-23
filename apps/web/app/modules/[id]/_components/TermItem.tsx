'use client';

import { useEffect, useRef, useState } from 'react';
import { Star, MoreHorizontal, Edit, Edit2, Trash } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Kept in sync with AddTerm — matching class means the inline editor
// looks and behaves identically to the "Add term" form.
const EditFieldClass =
  'w-full min-h-28 resize-y rounded-2xl border border-black/10 bg-white px-4 py-3 text-base leading-relaxed text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors hover:border-black/20 focus-visible:border-brand-400 focus-visible:ring-4 focus-visible:ring-brand-300/40 disabled:bg-neutral-50';

const KbdClass = 'font-mono rounded border border-black/10 bg-white px-1 text-neutral-700';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface TermItemProps {
  term: {
    id: string;
    term: string;
    definition: string;
    status?: string;
    isStarred: boolean;
  };
  onDelete: () => void;
  onToggleStar: () => void;
  onSaveEdit: (termId: string, term: string, definition: string) => void;
  isOwned: boolean;
  isCollected: boolean;
}

/**
 * Status pill — reflects the card's mastery bucket from the backend
 * (NEW / LEARNING / MASTERED, mapped to `not_started / in_progress /
 * completed` on the wire). A small colored dot is not enough to be
 * accessible; pair it with a text label.
 */
const statusStyles: Record<string, { dot: string; label: string; badge: string }> = {
  completed: {
    dot: 'bg-emerald-500',
    label: 'Mastered',
    badge: 'bg-emerald-50 text-emerald-700',
  },
  in_progress: {
    dot: 'bg-amber-500',
    label: 'Learning',
    badge: 'bg-amber-50 text-amber-700',
  },
  not_started: {
    dot: 'bg-neutral-300',
    label: 'New',
    badge: 'bg-neutral-100 text-neutral-600',
  },
};

export default function TermItem({
  term,
  onDelete,
  onToggleStar,
  onSaveEdit,
  isOwned,
  isCollected,
}: TermItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTermValue, setEditTermValue] = useState(term.term);
  const [editDefValue, setEditDefValue] = useState(term.definition);
  const editTermRef = useRef<HTMLTextAreaElement>(null);
  const editDefRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) editTermRef.current?.focus();
  }, [isEditing]);

  const handleStartEditing = () => {
    setEditTermValue(term.term);
    setEditDefValue(term.definition);
    setIsEditing(true);
  };

  const canSave = editTermValue.trim().length > 0 && editDefValue.trim().length > 0;

  const handleSaveEdit = () => {
    if (!canSave) return;
    onSaveEdit(term.id, editTermValue.trim(), editDefValue.trim());
    setIsEditing(false);
  };

  // Mirrors AddTerm: Enter in Term advances to Definition; Enter in
  // Definition submits; Shift+Enter is a newline; Ctrl/⌘+Enter always
  // submits; Escape cancels.
  const handleTermKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) handleSaveEdit();
      else editDefRef.current?.focus();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  const handleDefKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  const status = statusStyles[term.status ?? 'not_started'] ?? statusStyles.not_started;

  const StatusPill = (
    <div
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        status.badge,
      )}
      title={`Mastery: ${status.label}`}
      aria-label={`Mastery: ${status.label}`}
    >
      <span className={cn('size-2 rounded-full', status.dot)} />
      {status.label}
    </div>
  );

  if (isEditing) {
    return (
      <Card className="w-full gap-4 px-5 py-5">
        <div className="flex items-center justify-between gap-3">
          {StatusPill}
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-500">
            <span className="size-1.5 rounded-full bg-brand-400" />
            Editing
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor={`edit-term-${term.id}`}
              className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500"
            >
              Term
            </label>
            <textarea
              ref={editTermRef}
              id={`edit-term-${term.id}`}
              value={editTermValue}
              onChange={(e) => setEditTermValue(e.target.value)}
              onKeyDown={handleTermKey}
              rows={3}
              className={EditFieldClass}
              placeholder="e.g. photosynthesis"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor={`edit-def-${term.id}`}
              className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500"
            >
              Definition
            </label>
            <textarea
              ref={editDefRef}
              id={`edit-def-${term.id}`}
              value={editDefValue}
              onChange={(e) => setEditDefValue(e.target.value)}
              onKeyDown={handleDefKey}
              rows={3}
              className={EditFieldClass}
              placeholder="Explanation (Shift+Enter for a new line)"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/5 pt-4">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
            <span>
              <kbd className={KbdClass}>Enter</kbd> save
            </span>
            <span>
              <kbd className={KbdClass}>Shift+Enter</kbd> new line
            </span>
            <span>
              <kbd className={KbdClass}>Esc</kbd> cancel
            </span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={!canSave}>
              Save
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full flex-row items-center gap-3 px-4 py-4">
      {StatusPill}

      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="truncate text-base font-semibold text-neutral-900 sm:text-lg">
            {term.term}
          </div>
          <div className="w-px shrink-0 bg-black/10" />
          <div className="truncate text-base text-neutral-700 sm:text-lg">{term.definition}</div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isCollected && (
            <Button
              onClick={onToggleStar}
              variant="ghost"
              size="icon"
              aria-label={term.isStarred ? 'Remove star' : 'Add star'}
              aria-pressed={term.isStarred}
            >
              <Star
                className={cn(
                  'size-5 transition-colors',
                  term.isStarred
                    ? 'fill-brand-400 text-brand-400'
                    : 'text-neutral-300 hover:text-neutral-500',
                )}
              />
            </Button>
          )}

          {isOwned && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Term actions">
                  <MoreHorizontal className="size-5 text-neutral-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Term</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleStartEditing}>
                  <Edit className="size-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <Trash className="size-4 mr-2 text-neutral-400" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </Card>
  );
}
