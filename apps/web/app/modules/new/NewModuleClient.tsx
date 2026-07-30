'use client';

/**
 * "New module" page.
 *
 * Replaces the old AddModuleModal. Learners land here from the
 * dashboard's "+" button and can:
 *   - fill in module metadata (title, description, public/private)
 *   - draft an arbitrary number of flashcards inline
 *   - hit "Create module" once
 *
 * Submission is two-phase (module first, then flashcards) because
 * flashcards can't be created without a moduleId. If any flashcard
 * creation fails, we surface the failed count via toast but still
 * redirect to the module — the user can retry the failed rows there
 * rather than losing the whole draft.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Globe,
  Loader2,
  Lock,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { moduleKeys, useCreateModule } from '@/lib/hooks/useModules';
import { libraryKeys } from '@/lib/hooks/useLibrary';
import { useCreateTerm } from '@/lib/hooks/useTerms';
import { cn } from '@/lib/utils';

// Shared field style — mirrors the AddTerm/TermItem edit form so the
// flashcard rows feel like the same component across the app.
const FIELD_CLASS =
  'w-full min-h-24 resize-y rounded-2xl border border-black/10 bg-white px-4 py-3 text-base leading-relaxed text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors hover:border-black/20 focus-visible:border-brand-400 focus-visible:ring-4 focus-visible:ring-brand-300/40 disabled:bg-neutral-50';

const INPUT_CLASS =
  'w-full h-11 rounded-full border border-black/10 bg-white px-4 text-base text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors hover:border-black/20 focus-visible:border-brand-400 focus-visible:ring-4 focus-visible:ring-brand-300/40 disabled:bg-neutral-50';

const LABEL_CLASS =
  'text-[11px] font-semibold uppercase tracking-wide text-neutral-500';

interface DraftCard {
  /** Client-only id for React keys; never sent to the server. */
  key: string;
  term: string;
  definition: string;
}

function makeKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `k${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
}

function makeEmpty(): DraftCard {
  return { key: makeKey(), term: '', definition: '' };
}

export default function NewModuleClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [cards, setCards] = useState<DraftCard[]>(() => [
    makeEmpty(),
    makeEmpty(),
    makeEmpty(),
  ]);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const createModule = useCreateModule();
  const createTerm = useCreateTerm();

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const filledCards = cards.filter(
    (c) => c.term.trim() && c.definition.trim(),
  );
  const canSubmit = title.trim().length > 0 && !saving;

  const updateCard = (key: string, patch: Partial<DraftCard>) => {
    setCards((prev) =>
      prev.map((c) => (c.key === key ? { ...c, ...patch } : c)),
    );
  };

  const removeCard = (key: string) => {
    setCards((prev) => {
      const next = prev.filter((c) => c.key !== key);
      return next.length === 0 ? [makeEmpty()] : next;
    });
  };

  const addCard = () => {
    setCards((prev) => [...prev, makeEmpty()]);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const created = await createModule.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        isPrivate,
      });
      const moduleId = created.id;

      let failed = 0;
      for (const c of filledCards) {
        try {
          await createTerm.mutateAsync({
            moduleId,
            term: c.term.trim(),
            definition: c.definition.trim(),
            isStarred: false,
          });
        } catch {
          failed += 1;
        }
      }

      if (failed > 0) {
        toast.error(
          `${failed} card${failed === 1 ? '' : 's'} couldn't be saved — open the module to retry.`,
        );
      }

      await Promise.all([
        queryClient.refetchQueries({ queryKey: moduleKeys.lists() }),
        queryClient.refetchQueries({ queryKey: libraryKeys.sets() }),
      ]);

      router.push(`/modules/${moduleId}`);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to create module');
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-6 py-8 sm:px-8">
      <Button asChild variant="ghost" size="sm">
        <Link href="/dashboard">
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold text-neutral-900">
          Create a new module
        </h1>
        <p className="mt-2 text-neutral-600">
          Add a title, then draft the first few flashcards. You can add more
          later.
        </p>
      </div>

      {/* Module basics */}
      <Card>
        <CardContent className="space-y-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Module details
          </p>

          <div className="space-y-2">
            <label htmlFor="module-title" className={LABEL_CLASS}>
              Title <span className="ml-0.5 text-rose-500">*</span>
            </label>
            <input
              ref={titleRef}
              id="module-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Advanced Biology"
              disabled={saving}
              className={INPUT_CLASS}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="module-description" className={LABEL_CLASS}>
              Description
              <span className="ml-1 font-normal normal-case text-neutral-400">
                (optional)
              </span>
            </label>
            <textarea
              id="module-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this module for?"
              rows={2}
              disabled={saving}
              className={cn(FIELD_CLASS, 'min-h-20')}
            />
          </div>

          <div className="space-y-2">
            <span className={LABEL_CLASS}>Visibility</span>
            <div
              role="radiogroup"
              aria-label="Visibility"
              className="grid grid-cols-2 gap-2"
            >
              <VisibilityOption
                selected={!isPrivate}
                onClick={() => setIsPrivate(false)}
                icon={<Globe className="h-4 w-4" />}
                label="Public"
                hint="Anyone can find & save it."
                disabled={saving}
              />
              <VisibilityOption
                selected={isPrivate}
                onClick={() => setIsPrivate(true)}
                icon={<Lock className="h-4 w-4" />}
                label="Private"
                hint="Only you can see it."
                disabled={saving}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Flashcards */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Flashcards
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                {filledCards.length} of {cards.length} filled — empty rows
                are skipped.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {cards.map((c, i) => (
              <FlashcardRow
                key={c.key}
                index={i}
                card={c}
                canRemove={cards.length > 1}
                disabled={saving}
                onChange={(patch) => updateCard(c.key, patch)}
                onRemove={() => removeCard(c.key)}
                onAppendIfLast={() => {
                  if (i === cards.length - 1) addCard();
                }}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={addCard}
            disabled={saving}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-black/10 bg-white/40 text-sm font-medium text-neutral-700 transition-colors hover:border-brand-400 hover:bg-brand-300/10 hover:text-brand-500 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add another card
          </button>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-neutral-500">
          {title.trim() ? (
            <>
              Creating <span className="font-medium">{title.trim()}</span>{' '}
              with {filledCards.length}{' '}
              {filledCards.length === 1 ? 'flashcard' : 'flashcards'}.
            </>
          ) : (
            'Title is required.'
          )}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="min-w-32"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              'Create module'
            )}
          </Button>
        </div>
      </div>
    </main>
  );
}

// ============================================================
// Sub-components
// ============================================================

function VisibilityOption({
  selected,
  onClick,
  icon,
  label,
  hint,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-2xl border p-4 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300/40',
        selected
          ? 'border-brand-400 bg-brand-300/15'
          : 'border-black/10 bg-white hover:border-black/20',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 font-semibold',
          selected ? 'text-brand-500' : 'text-neutral-800',
        )}
      >
        {icon}
        {label}
      </div>
      <div className="mt-1 text-xs text-neutral-500">{hint}</div>
    </button>
  );
}

function FlashcardRow({
  index,
  card,
  canRemove,
  disabled,
  onChange,
  onRemove,
  onAppendIfLast,
}: {
  index: number;
  card: DraftCard;
  canRemove: boolean;
  disabled: boolean;
  onChange: (patch: Partial<DraftCard>) => void;
  onRemove: () => void;
  onAppendIfLast: () => void;
}) {
  const termRef = useRef<HTMLTextAreaElement>(null);
  const defRef = useRef<HTMLTextAreaElement>(null);

  const handleTermKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      defRef.current?.focus();
    }
  };

  const handleDefKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onAppendIfLast();
      queueMicrotask(() => {
        const next = document.querySelector<HTMLTextAreaElement>(
          `[data-card-term="${index + 1}"]`,
        );
        next?.focus();
      });
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-black/5 bg-white/60 p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-neutral-400">
          #{(index + 1).toString().padStart(2, '0')}
        </span>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled || !canRemove}
          aria-label="Remove card"
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition-colors',
            canRemove && !disabled && 'hover:bg-rose-50 hover:text-rose-600',
            !canRemove && 'cursor-not-allowed opacity-30',
          )}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className={LABEL_CLASS}>Term</label>
          <textarea
            ref={termRef}
            data-card-term={index}
            value={card.term}
            onChange={(e) => onChange({ term: e.target.value })}
            onKeyDown={handleTermKey}
            placeholder="e.g. photosynthesis"
            rows={3}
            disabled={disabled}
            className={FIELD_CLASS}
          />
        </div>
        <div className="space-y-2">
          <label className={LABEL_CLASS}>Definition</label>
          <textarea
            ref={defRef}
            value={card.definition}
            onChange={(e) => onChange({ definition: e.target.value })}
            onKeyDown={handleDefKey}
            placeholder="Explanation (Shift+Enter for a new line)"
            rows={3}
            disabled={disabled}
            className={FIELD_CLASS}
          />
        </div>
      </div>
    </div>
  );
}
