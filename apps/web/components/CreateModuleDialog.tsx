'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Folder as FolderIcon, Globe, Loader2, Lock, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  ImportFlashcardsDialog,
  type ImportedCard,
} from '@/components/import-flashcards-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createTerm } from '@/lib/api';
import { useAddSetsToFolder, useFolders } from '@/lib/hooks/useLibrary';
import { useCreateModule } from '@/lib/hooks/useModules';
import { termKeys } from '@/lib/hooks/useTerms';
import { cn } from '@/lib/utils';

const noFolder = '__none__';

const fieldClass =
  'w-full min-h-24 resize-y rounded-2xl border border-black/10 bg-white px-4 py-3 text-base leading-relaxed text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors hover:border-black/20 focus-visible:border-brand-400 focus-visible:ring-4 focus-visible:ring-brand-300/40 disabled:bg-neutral-50';

const labelClass = 'text-[11px] font-semibold uppercase tracking-wide text-neutral-500';

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

export function CreateModuleDialog({ open, onOpenChange, defaultFolderId }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [folderId, setFolderId] = useState<string>(defaultFolderId ?? noFolder);
  const [cards, setCards] = useState<DraftCard[]>(() => [emptyCard(), emptyCard(), emptyCard()]);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const folders = useFolders({ enabled: open });
  const createModule = useCreateModule();
  const addToFolder = useAddSetsToFolder();

  // Focus title on mount. State reset between opens is handled by the
  // provider remounting this component with a fresh `key`, so no
  // effect-driven cleanup is needed here.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const filledCards = cards.filter((c) => c.term.trim() && c.definition.trim());
  const canSubmit = title.trim().length > 0 && !saving;

  const updateCard = (key: string, patch: Partial<DraftCard>) => {
    setCards((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  };

  const removeCard = (key: string) => {
    setCards((prev) => {
      const next = prev.filter((c) => c.key !== key);
      return next.length === 0 ? [emptyCard()] : next;
    });
  };

  const addCard = () => setCards((prev) => [...prev, emptyCard()]);

  /**
   * Merge imported cards into the draft list. Empty draft rows are
   * reused first (so a fresh dialog with 3 blanks + 5 imports ends up
   * with 5 cards, not 8), then any extras append.
   */
  const mergeImported = (imported: ImportedCard[]) => {
    if (imported.length === 0) return;
    setCards((prev) => {
      const next = [...prev];
      let cursor = 0;
      for (const c of imported) {
        while (
          cursor < next.length &&
          (next[cursor].term.trim() || next[cursor].definition.trim())
        ) {
          cursor++;
        }
        if (cursor < next.length) {
          next[cursor] = { ...next[cursor], term: c.term, definition: c.definition };
          cursor++;
        } else {
          next.push({ key: makeKey(), term: c.term, definition: c.definition });
        }
      }
      return next;
    });
    toast.success(
      `Imported ${imported.length} ${imported.length === 1 ? 'card' : 'cards'}.`,
    );
  };

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

      if (folderId !== noFolder) {
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
        className="flex flex-col gap-0 p-0 sm:max-w-5xl max-h-[85vh] overflow-hidden"
      >
        <DialogHeader className="shrink-0 border-b border-black/5 px-6 pr-14 pt-6 pb-4">
          <DialogTitle className="text-2xl font-bold text-neutral-900">
            Create a new module
          </DialogTitle>
          <DialogDescription>
            Set the details on the left, then draft your first few flashcards on the right.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[minmax(0,320px)_1fr]">
          {/* Left column — module details */}
          <div className="space-y-5 overflow-y-auto border-b border-black/5 p-6 md:border-b-0 md:border-r">
            <div className="space-y-2">
              <Label htmlFor="module-title" className="text-neutral-500">
                Title <span className="text-rose-500">*</span>
              </Label>
              <Input
                ref={titleRef}
                id="module-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Advanced Biology"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="module-description" className="text-neutral-500">
                Description{' '}
                <span className="ml-1 font-normal normal-case text-neutral-400">(optional)</span>
              </Label>
              <Textarea
                id="module-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this module for?"
                rows={3}
                disabled={saving}
                className={cn(fieldClass, 'min-h-24')}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-neutral-500">Visibility</Label>
              <div role="radiogroup" aria-label="Visibility" className="grid grid-cols-2 gap-2">
                <VisibilityOption
                  selected={!isPrivate}
                  onClick={() => setIsPrivate(false)}
                  icon={<Globe className="h-4 w-4" />}
                  label="Public"
                  disabled={saving}
                />
                <VisibilityOption
                  selected={isPrivate}
                  onClick={() => setIsPrivate(true)}
                  icon={<Lock className="h-4 w-4" />}
                  label="Private"
                  disabled={saving}
                />
              </div>
            </div>

            {/* Folder selection */}
            <div className="shrink-0 space-y-2">
              <Label htmlFor="module-folder" className="text-neutral-500">
                Folder <span className="text-neutral-500">(optional)</span>
              </Label>
              <Select
                value={folderId}
                onValueChange={setFolderId}
                disabled={saving || folders.isLoading}
              >
                <SelectTrigger id="module-folder" className="w-full">
                  <SelectValue placeholder="No folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={noFolder}>No folder</SelectItem>
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
          </div>

          {/* Right column — folder + flashcards */}
          <div className="flex min-h-0 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label className="text-neutral-500">Flashcards</Label>
                  <p className="mt-1 text-xs text-neutral-500">
                    {filledCards.length} of {cards.length} filled — empty rows are skipped.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setImportOpen(true)}
                  disabled={saving}
                >
                  <Upload className="h-4 w-4" />
                  Import
                </Button>
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

              <Button
                type="button"
                variant="outline"
                onClick={addCard}
                disabled={saving}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-black/10 bg-white/40 text-sm font-medium text-neutral-700 transition-colors hover:border-brand-400 hover:bg-brand-300/10 hover:text-brand-500 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Add another card
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 flex-col-reverse items-stretch gap-3 border-t border-black/5 bg-neutral-50/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-neutral-500">
            {title.trim() ? (
              <>
                Creating <span className="font-medium">{title.trim()}</span> with{' '}
                {filledCards.length} {filledCards.length === 1 ? 'flashcard' : 'flashcards'}.
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
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit} className="min-w-32">
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

      <ImportFlashcardsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={mergeImported}
        submitLabel="Add to draft"
      />
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
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-auto w-full flex-col items-start justify-start p-2 px-3',
        selected
          ? 'border-brand-400 bg-brand-300/15 hover:bg-brand-300/15'
          : ' bg-white hover:border-black/20 hover:bg-white',
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
      {/* <div className="mt-1 text-xs font-normal text-neutral-500">{hint}</div> */}
    </Button>
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
        const next = document.querySelector<HTMLTextAreaElement>(`[data-card-term="${index + 1}"]`);
        next?.focus();
      });
    }
  };

  return (
    <div className="rounded-2xl border border-black/5 bg-white/60 p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-neutral-400">
          #{(index + 1).toString().padStart(2, '0')}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          disabled={disabled || !canRemove}
          aria-label="Remove card"
          className={cn(
            'h-8 w-8 rounded-full text-neutral-400 transition-colors',
            canRemove && !disabled && 'hover:bg-rose-50 hover:text-rose-600',
            !canRemove && 'cursor-not-allowed opacity-30',
          )}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          {/* <Label className={labelClass}>Term</Label> */}
          <Textarea
            ref={termRef}
            data-card-term={index}
            value={card.term}
            onChange={(e) => onChange({ term: e.target.value })}
            onKeyDown={handleTermKey}
            placeholder="Enter the term"
            rows={2}
            disabled={disabled}
            className={fieldClass}
          />
        </div>
        <div className="space-y-2">
          {/* <Label className={labelClass}>Definition</Label> */}
          <Textarea
            ref={defRef}
            value={card.definition}
            onChange={(e) => onChange({ definition: e.target.value })}
            onKeyDown={handleDefKey}
            placeholder="Enter the definition"
            rows={2}
            disabled={disabled}
            className={fieldClass}
          />
        </div>
      </div>
    </div>
  );
}
