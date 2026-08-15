'use client';

/**
 * Per-set Test Mode preferences editor. Parallel to
 * StudyPreferencesDialog but scoped to Test-specific knobs:
 * questionCount, allowedTypes, answerDirection, strictness,
 * starredOnly, shuffleEnabled, showResultsPerQuestion,
 * matchingPairCount.
 *
 * Fed by useTestPreferences (query with server-side defaults on
 * cache miss) + useUpdateTestPreferences for writes.
 */

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';

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
import { cn } from '@/lib/utils';
import type { TestPreferences } from '@/lib/api';
import {
  useTestPreferences,
  useUpdateTestPreferences,
} from '@/lib/hooks/useTestPreferences';

const QUESTION_TYPES = ['TEST_MC', 'TEST_WRITTEN', 'TEST_TF', 'TEST_MATCH'] as const;

const preferencesSchema = z.object({
  questionCount: z.number().int().min(5).max(50),
  allowedTypes: z.array(z.enum(QUESTION_TYPES)).min(1),
  answerDirection: z.enum([
    'TERM_TO_DEFINITION',
    'DEFINITION_TO_TERM',
    'MIXED',
  ]),
  strictness: z.enum(['STRICT', 'NORMAL', 'LENIENT']),
  starredOnly: z.boolean(),
  shuffleEnabled: z.boolean(),
  showResultsPerQuestion: z.boolean(),
  matchingPairCount: z.number().int().min(4).max(8),
});

type PreferencesForm = z.infer<typeof preferencesSchema>;

const STRICTNESS_OPTIONS: {
  value: PreferencesForm['strictness'];
  label: string;
  blurb: string;
}[] = [
  { value: 'STRICT', label: 'Strict', blurb: 'Exact match only' },
  { value: 'NORMAL', label: 'Normal', blurb: 'Accepts typos + variants' },
  { value: 'LENIENT', label: 'Lenient', blurb: 'Extra typo tolerance' },
];

const DIRECTION_OPTIONS: {
  value: PreferencesForm['answerDirection'];
  label: string;
  blurb: string;
}[] = [
  {
    value: 'TERM_TO_DEFINITION',
    label: 'Term → Definition',
    blurb: 'See the term, produce the definition',
  },
  {
    value: 'DEFINITION_TO_TERM',
    label: 'Definition → Term',
    blurb: 'See the definition, produce the term',
  },
  {
    value: 'MIXED',
    label: 'Mixed',
    blurb: 'Random per question',
  },
];

const TYPE_LABELS: Record<(typeof QUESTION_TYPES)[number], string> = {
  TEST_MC: 'Multiple choice',
  TEST_WRITTEN: 'Written',
  TEST_TF: 'True / False',
  TEST_MATCH: 'Matching',
};

const TYPE_BLURBS: Record<(typeof QUESTION_TYPES)[number], string> = {
  TEST_MC: 'Pick from 4 options',
  TEST_WRITTEN: 'Type the answer',
  TEST_TF: 'Judge a pairing',
  TEST_MATCH: 'Match a grid of pairs',
};

export function TestPreferencesDialog({
  open,
  onOpenChange,
  setId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setId: string;
}) {
  const { data: prefs, isLoading } = useTestPreferences(setId, open);
  const update = useUpdateTestPreferences(setId);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !update.isPending && onOpenChange(next)}
    >
      {/* Same shape as StudyPreferencesDialog — flex column capped at
          85vh so the fields scroll and the footer sticks. */}
      <DialogContent className="w-[95vw] max-w-3xl! sm:max-w-3xl! flex! max-h-[85vh] flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Test preferences</DialogTitle>
          <DialogDescription>
            Configure how tests are generated for this set. Changes apply to
            your next test — attempts already in flight keep their original
            configuration.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !prefs ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
          </div>
        ) : (
          <PreferencesForm
            key={`${prefs.questionCount}-${prefs.allowedTypes.join(',')}`}
            initial={prefs}
            saving={update.isPending}
            onSave={async (values) => {
              await update.mutateAsync(values);
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PreferencesForm({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial: TestPreferences;
  saving: boolean;
  onSave: (values: PreferencesForm) => Promise<void>;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<PreferencesForm>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: initial,
  });

  useEffect(() => {
    reset(initial);
  }, [initial, reset]);

  const allowedTypes = watch('allowedTypes');
  const answerDirection = watch('answerDirection');
  const strictness = watch('strictness');
  const starredOnly = watch('starredOnly');
  const shuffleEnabled = watch('shuffleEnabled');
  const showResultsPerQuestion = watch('showResultsPerQuestion');

  const matchingEnabled = allowedTypes.includes('TEST_MATCH');

  const toggleType = (t: (typeof QUESTION_TYPES)[number]) => {
    const next = allowedTypes.includes(t)
      ? allowedTypes.filter((x) => x !== t)
      : [...allowedTypes, t];
    // Enforce non-empty at the UI level too — the server rejects an
    // empty array but this is a friendlier failure mode.
    if (next.length === 0) return;
    setValue('allowedTypes', next, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <form
      onSubmit={handleSubmit(onSave)}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div className="flex-1 space-y-5 overflow-y-auto pr-1">
        {/* Question count — the primary control learners think about
            when configuring a test. */}
        <div className="space-y-2">
          <Label htmlFor="questionCount">Question count</Label>
          <Input
            id="questionCount"
            type="number"
            min={5}
            max={50}
            {...register('questionCount', { valueAsNumber: true })}
          />
          <p className="text-xs text-neutral-500">
            Target scoring slots (5–50). A matching question consumes multiple
            slots — the actual question count adjusts to fit.
          </p>
          {errors.questionCount && (
            <p className="text-xs text-rose-600">
              {errors.questionCount.message}
            </p>
          )}
        </div>

        {/* Question types — checkbox pills. Must have at least one
            selected. */}
        <div className="space-y-2">
          <Label>Question types</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {QUESTION_TYPES.map((t) => (
              <TypeChip
                key={t}
                active={allowedTypes.includes(t)}
                label={TYPE_LABELS[t]}
                blurb={TYPE_BLURBS[t]}
                onClick={() => toggleType(t)}
              />
            ))}
          </div>
          {errors.allowedTypes && (
            <p className="text-xs text-rose-600">Pick at least one type.</p>
          )}
        </div>

        {matchingEnabled && (
          <div className="space-y-2">
            <Label htmlFor="matchingPairCount">Matching pair count</Label>
            <Input
              id="matchingPairCount"
              type="number"
              min={4}
              max={8}
              {...register('matchingPairCount', { valueAsNumber: true })}
            />
            <p className="text-xs text-neutral-500">
              How many pairs the single matching question shows (4–8).
            </p>
          </div>
        )}

        {/* Answer direction — 3-way segmented (adds MIXED vs Learn's
            2-way). */}
        <SegmentedRow
          label="Answer direction"
          description="Which side you produce."
          options={DIRECTION_OPTIONS}
          value={answerDirection}
          onChange={(v) => setValue('answerDirection', v, { shouldDirty: true })}
        />

        {/* Grading strictness — same tiers as Learn Mode. STRICT is a
            natural default for tests but NORMAL keeps parity. */}
        <SegmentedRow
          label="Grading strictness"
          description="How lenient the written-answer check is."
          options={STRICTNESS_OPTIONS}
          value={strictness}
          onChange={(v) => setValue('strictness', v, { shouldDirty: true })}
        />

        {/* Pool controls. */}
        <div className="space-y-3 rounded-2xl border border-black/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Pool
          </p>
          <ToggleRow
            label="Starred cards only"
            description="Only draw questions from cards you've starred. Requires enough starred cards to fill the test."
            value={starredOnly}
            onChange={(v) => setValue('starredOnly', v, { shouldDirty: true })}
          />
          <ToggleRow
            label="Shuffle cards"
            description="When off, questions follow the card order in the set."
            value={shuffleEnabled}
            onChange={(v) => setValue('shuffleEnabled', v, { shouldDirty: true })}
          />
        </div>

        {/* Result-reveal timing. NOTE: the per-question reveal path
            isn't wired in the client yet — the toggle persists for
            when that ships. */}
        <ToggleRow
          label="Show results per question"
          description="Reveal correctness after each answer instead of only at the end. Coming soon — the toggle saves for when it ships."
          value={showResultsPerQuestion}
          onChange={(v) =>
            setValue('showResultsPerQuestion', v, { shouldDirty: true })
          }
        />
      </div>

      <DialogFooter className="mt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !isDirty}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ============================================================
// Small primitives (mirrors StudyPreferencesDialog's shape)
// ============================================================

function TypeChip({
  active,
  label,
  blurb,
  onClick,
}: {
  active: boolean;
  label: string;
  blurb: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex flex-col gap-0.5 rounded-2xl border p-3 text-left transition-all',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300/40',
        active
          ? 'border-brand-500 bg-brand-500 text-white'
          : 'border-black/10 bg-white hover:border-brand-400 hover:bg-brand-300/10',
      )}
    >
      <span
        className={cn(
          'text-sm font-semibold',
          active ? 'text-white' : 'text-neutral-900',
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'text-xs',
          active ? 'text-white/85' : 'text-neutral-500',
        )}
      >
        {blurb}
      </span>
    </button>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-black/10 bg-neutral-50 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-neutral-900">{label}</p>
        <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        <ToggleChip active={!value} onClick={() => onChange(false)}>
          Off
        </ToggleChip>
        <ToggleChip active={value} onClick={() => onChange(true)}>
          On
        </ToggleChip>
      </div>
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
        active
          ? 'bg-brand-500 text-white'
          : 'bg-white text-neutral-500 hover:bg-neutral-100',
      )}
    >
      {children}
    </button>
  );
}

function SegmentedRow<V extends string>({
  label,
  description,
  options,
  value,
  onChange,
}: {
  label: string;
  description: string;
  options: readonly { value: V; label: string; blurb: string }[];
  value: V;
  onChange: (next: V) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="font-semibold text-neutral-900">{label}</p>
        <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
      </div>
      <div
        className={cn(
          'grid gap-2',
          options.length === 2 ? 'grid-cols-2' : 'grid-cols-3',
        )}
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-2xl border p-3 text-left transition-all',
              value === opt.value
                ? 'border-brand-400 bg-brand-300/15'
                : 'border-black/10 bg-white hover:border-black/20',
            )}
          >
            <p className="text-sm font-semibold text-neutral-900">
              {opt.label}
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">{opt.blurb}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
