'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  Folder as FolderIcon,
  Globe,
  Loader2,
  Lock,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createTerm } from '@/lib/api';
import { useAddSetsToFolder, useFolders } from '@/lib/hooks/useLibrary';
import { useCreateModule } from '@/lib/hooks/useModules';
import { termKeys } from '@/lib/hooks/useTerms';
import { cn } from '@/lib/utils';

const NO_FOLDER = '__none__';

const FIELD_CLASS =
  'w-full min-h-24 resize-y rounded-2xl border border-black/10 bg-white px-4 py-3 text-base leading-relaxed text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors hover:border-black/20 focus-visible:border-brand-400 focus-visible:ring-4 focus-visible:ring-brand-300/40 disabled:bg-neutral-50';

const INPUT_CLASS =
  'w-full h-11 rounded-full border border-black/10 bg-white px-4 text-base text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors hover:border-black/20 focus-visible:border-brand-400 focus-visible:ring-4 focus-visible:ring-brand-300/40 disabled:bg-neutral-50';

const LABEL_CLASS =
  'text-[11px] font-semibold uppercase tracking-wide text-neutral-500';

interface DraftCard {
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

const emptyCard = (): DraftCard => ({
  key: makeKey(),
  term: '',
  definition: '',
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultFolderId?: string;
}

export function CreateModuleDialog({
  open,
  onOpenChange,
  defaultFolderId,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [folderId, setFolderId] = useState<string>(
    defaultFolderId ?? NO_FOLDER,
  );
  const [cards, setCards] = useState<DraftCard[]>(() => [
    emptyCard(),
    emptyCard(),
    emptyCard(),
  ]);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const folders = useFolders();
  const createModule = useCreateModule();
  const addToFolder = useAddSetsToFolder();

  // Focus title on mount. State reset between opens is handled by the
  // provider remounting this component with a fresh `key`, so no
  // effect-driven cleanup is needed here.
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
      return next.length === 0 ? [emptyCard()] : next;
    });
  };

  const addCard = () => setCards((prev) => [...prev, emptyCard()]);

  const handleOpenChange = (next: boolean) => {
    if (saving) return;
    onOpenChange(next);
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

      if (folderId !== NO_FOLDER) {
        try {
          await addToFolder.mutateAsync({
            folderId,
            studySetIds: [moduleId],
          });
        } catch {
          toast.error("Module created, but couldn't add it to the folder.");
        }
      }

      // Fire flashcards in parallel; hook-level toast is skipped by
      // calling the raw API directly (avoids N success toasts).
      const results = await Promise.allSettled(
        filledCards.map((c) =>
          createTerm({
            moduleId,
            term: c.term.trim(),
            definition: c.definition.trim(),
            isStarred: false,
          }),
        ),
      );
      const failed = results.filter((r) => r.status === 'rejected').length;

      if (failed > 0) {
        toast.error(
          `${failed} card${failed === 1 ? '' : 's'} couldn't be saved — open the module to retry.`,
        );
      }
      if (filledCards.length > 0) {
        queryClient.invalidateQueries({
          queryKey: termKeys.listsForModule(moduleId),
        });
      }

      onOpenChange(false);
      router.push(`/modules/${moduleId}`);
    } catch {
      // useCreateModule already surfaces the error via toast.
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!saving}
        className="flex flex-col gap-0 p-0 sm:max-w-4xl max-h-[85vh] overflow-hidden"
      >
        <DialogHeader className="shrink-0 border-b border-black/5 px-6 pr-14 pt-6 pb-4">
          <DialogTitle className="text-2xl font-bold text-neutral-900">
            Create a new module
          </DialogTitle>
          <DialogDescription>
            Set the details on the left, then draft your first few flashcards
            on the right.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[minmax(0,320px)_1fr]">
          {/* Left column — module details */}
          <div className="space-y-5 overflow-y-auto border-b border-black/5 p-6 md:border-b-0 md:border-r">
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
                Description{' '}
                <span className="ml-1 font-normal normal-case text-neutral-400">
                  (optional)
                </span>
              </label>
              <textarea
                id="module-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this module for?"
                rows={3}
                disabled={saving}
                className={cn(FIELD_CLASS, 'min-h-24')}
              />
            </div>

            <div className="space-y-2">
              <span className={LABEL_CLASS}>Visibility</span>
              <div
                role="radiogroup"
                aria-label="Visibility"
                className="grid grid-cols-1 gap-2"
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
          </div>

          {/* Right column — folder + flashcards */}
          <div className="flex min-h-0 flex-col overflow-hidden">
            <div className="shrink-0 space-y-2 border-b border-black/5 p-6 pb-4">
              <label htmlFor="module-folder" className={LABEL_CLASS}>
                Folder{' '}
                <span className="ml-1 font-normal normal-case text-neutral-400">
                  (optional)
                </span>
              </label>
              <Select
                value={folderId}
                onValueChange={setFolderId}
                disabled={saving || folders.isLoading}
              >
                <SelectTrigger id="module-folder" className="w-full">
                  <SelectValue placeholder="No folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FOLDER}>No folder</SelectItem>
                  {(folders.data ?? []).map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      <span className="inline-flex items-center gap-2">
                        <FolderIcon className="h-4 w-4 text-neutral-500" />
                        {f.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6 pt-4">
              <div>
                <p className={LABEL_CLASS}>Flashcards</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {filledCards.length} of {cards.length} filled — empty rows
                  are skipped.
                </p>
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
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 flex-col-reverse items-stretch gap-3 border-t border-black/5 bg-neutral-50/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="flex gap-2 sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
            rows={2}
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
            rows={2}
            disabled={disabled}
            className={FIELD_CLASS}
          />
        </div>
      </div>
    </div>
  );
}
