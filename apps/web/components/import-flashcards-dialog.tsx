'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, ClipboardPaste, FileText, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
import { parseImport, type PresetBetween, type PresetCard } from '@/lib/importFlashcards';
import { cn } from '@/lib/utils';

export interface ImportedCard {
  term: string;
  definition: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (cards: ImportedCard[]) => void | Promise<void>;
  /** Copy on the primary action button. */
  submitLabel?: string;
  /** External busy state — disables the submit button and inputs. */
  isSubmitting?: boolean;
  /**
   * When true, close the dialog automatically after `onImport` resolves.
   * Set false for consumers that want to keep it open (e.g. show a
   * server error inline before closing).
   */
  closeOnSuccess?: boolean;
}

export function ImportFlashcardsDialog({
  open,
  onOpenChange,
  onImport,
  submitLabel = 'Import cards',
  isSubmitting = false,
  closeOnSuccess = true,
}: Props) {
  const [text, setText] = useState('');
  const [betweenPreset, setBetweenPreset] = useState<PresetBetween>('tab');
  const [betweenCustom, setBetweenCustom] = useState('');
  const [cardPreset, setCardPreset] = useState<PresetCard>('newline');
  const [cardCustom, setCardCustom] = useState('');

  const parsed = useMemo(
    () =>
      parseImport({
        text,
        betweenPreset,
        betweenCustom,
        cardPreset,
        cardCustom,
      }),
    [text, betweenPreset, betweenCustom, cardPreset, cardCustom],
  );

  const canSubmit = parsed.cards.length > 0 && !isSubmitting;

  const resetForm = () => {
    setText('');
    setBetweenPreset('tab');
    setBetweenCustom('');
    setCardPreset('newline');
    setCardCustom('');
  };

  const handleOpenChange = (next: boolean) => {
    if (isSubmitting) return;
    if (!next) resetForm();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onImport(parsed.cards.map((c) => ({ term: c.term, definition: c.definition })));
    if (closeOnSuccess) {
      resetForm();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!isSubmitting}
        className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        <DialogHeader className="shrink-0 border-b border-black/5 px-6 pr-14 pt-6 pb-4">
          <DialogTitle className="text-2xl font-bold text-neutral-900">
            Import flashcards
          </DialogTitle>
          <DialogDescription>
            Paste your data on the right, then pick how each card and each term/definition pair is
            separated.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[minmax(0,320px)_1fr]">
          {/* Left column — separator controls + preview summary */}
          <div className="space-y-5 overflow-y-auto border-b border-black/5 p-6 md:border-b-0 md:border-r">
            <SeparatorField
              label="Between term & definition"
              preset={betweenPreset}
              onPresetChange={(v) => setBetweenPreset(v as PresetBetween)}
              custom={betweenCustom}
              onCustomChange={setBetweenCustom}
              disabled={isSubmitting}
              presetOptions={[
                { value: 'tab', label: 'Tab' },
                { value: 'comma', label: 'Comma  ,' },
                { value: 'dash', label: 'Dash  -' },
                { value: 'semicolon', label: 'Semicolon  ;' },
                { value: 'custom', label: 'Custom…' },
              ]}
            />

            <SeparatorField
              label="Between cards"
              preset={cardPreset}
              onPresetChange={(v) => setCardPreset(v as PresetCard)}
              custom={cardCustom}
              onCustomChange={setCardCustom}
              disabled={isSubmitting}
              presetOptions={[
                { value: 'newline', label: 'New line' },
                { value: 'doubleNewline', label: 'Blank line' },
                { value: 'semicolon', label: 'Semicolon  ;' },
                { value: 'custom', label: 'Custom…' },
              ]}
            />

            <div className="rounded-2xl border border-black/5 bg-neutral-50/60 p-4">
              <p className="text-neutral-500 text-xs">Summary</p>
              <div className="mt-3 space-y-1.5 text-sm">
                <SummaryRow
                  label="Ready to import"
                  value={parsed.cards.length}
                  tone={parsed.cards.length > 0 ? 'success' : 'muted'}
                />
                <SummaryRow
                  label="Skipped"
                  value={parsed.skipped.length}
                  tone={parsed.skipped.length > 0 ? 'warn' : 'muted'}
                />
                <SummaryRow label="Detected entries" value={parsed.total} tone="muted" />
              </div>
            </div>
          </div>

          {/* Right column — textarea + preview list */}
          <div className="flex min-h-0 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-black/5 px-6 pt-6 pb-2">
              <Label htmlFor="import-text" className="text-neutral-500 text-xs">
                <FileText className="h-3.5 w-3.5" />
                Paste your data
              </Label>
            </div>

            <div className="flex min-h-0 flex-col gap-4 overflow-hidden px-6 pb-4">
              <Textarea
                id="import-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter the text for import"
                disabled={isSubmitting}
                spellCheck={false}
                className="w-full min-h-64 flex-1 resize-none rounded-2xl mt-2"
              />

              <PreviewList parsed={parsed} />
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 flex-col-reverse items-stretch gap-3 border-t border-black/5 bg-neutral-50/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-neutral-500">
            {parsed.cards.length > 0 ? (
              <>
                Ready to import <span className="font-medium">{parsed.cards.length}</span>{' '}
                {parsed.cards.length === 1 ? 'card' : 'cards'}
                {parsed.skipped.length > 0 && <> — {parsed.skipped.length} skipped</>}.
              </>
            ) : text.trim() ? (
              'No cards detected. Check the separators on the left.'
            ) : (
              'Paste some content to preview cards.'
            )}
          </p>
          <div className="flex gap-2 sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit} className="min-w-32">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing…
                </>
              ) : (
                submitLabel
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

function SeparatorField({
  label,
  preset,
  onPresetChange,
  custom,
  onCustomChange,
  presetOptions,
  disabled,
}: {
  label: string;
  preset: string;
  onPresetChange: (value: string) => void;
  custom: string;
  onCustomChange: (value: string) => void;
  presetOptions: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-neutral-500 text-xs">{label}</Label>
      <Select value={preset} onValueChange={onPresetChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {presetOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {preset === 'custom' && (
        <Input
          type="text"
          value={custom}
          onChange={(e) => onCustomChange(e.target.value)}
          placeholder="e.g. :: or \t"
          disabled={disabled}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'success' | 'warn' | 'muted';
}) {
  const toneClass = {
    success: 'text-emerald-700',
    warn: 'text-amber-600',
    muted: 'text-neutral-500',
  }[tone];
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-600">{label}</span>
      <span className={cn('font-semibold tabular-nums', toneClass)}>{value}</span>
    </div>
  );
}

function PreviewList({ parsed }: { parsed: ReturnType<typeof parseImport> }) {
  if (parsed.total === 0) {
    return (
      <div className="flex min-h-[8rem] items-center justify-center rounded-2xl border border-dashed border-black/10 bg-white/40 px-4 text-center text-sm text-neutral-500">
        Preview will appear here as you paste.
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-2xl border border-black/5 bg-white/60 p-3">
      <p className="text-neutral-500 text-xs">Preview</p>
      {parsed.cards.map((c) => (
        <div
          key={`ok-${c.index}`}
          className="grid grid-cols-[auto_1fr_1fr] items-start gap-3 rounded-xl bg-white px-3 py-2 text-sm shadow-[0_1px_0_rgba(0,0,0,0.04)]"
        >
          <span className="pt-0.5 font-mono text-xs text-neutral-400">
            #{c.index.toString().padStart(2, '0')}
          </span>
          <span className="min-w-0 break-words font-medium text-neutral-900">{c.term}</span>
          <span className="min-w-0 break-words text-neutral-600">{c.definition}</span>
        </div>
      ))}
      {parsed.skipped.map((s) => (
        <div
          key={`skip-${s.index}`}
          className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm text-amber-800"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide">
              #{s.index.toString().padStart(2, '0')} · {skipLabel(s.reason)}
            </p>
            <p className="mt-0.5 break-words font-mono text-xs text-amber-900/80">
              {truncate(s.raw, 140)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function skipLabel(reason: 'missing-separator' | 'empty-term' | 'empty-definition') {
  switch (reason) {
    case 'missing-separator':
      return 'no term/definition separator';
    case 'empty-term':
      return 'empty term';
    case 'empty-definition':
      return 'empty definition';
  }
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
