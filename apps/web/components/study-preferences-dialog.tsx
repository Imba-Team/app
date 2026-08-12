'use client';

/**
 * Per-set study preferences editor. Fed by useSetPreferences (queries
 * effective prefs, with server-side fallback to module defaults) and
 * useUpdateSetPreferences / useApplyPacePreset for writes.
 *
 * Preset buttons overwrite the four "pace" knobs — batchSize,
 * mcWrittenBias, masteryThreshold, autoAdvanceMs — but leave hint
 * multiplier and audio untouched, matching the server's applyPreset
 * behaviour.
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
import type { PacePreset, SetPreferences } from '@/lib/api';
import {
  useApplyPacePreset,
  useSetPreferences,
  useUpdateSetPreferences,
} from '@/lib/hooks/useSetPreferences';

const preferencesSchema = z.object({
  batchSize: z.number().int().min(1).max(50),
  mcWrittenBias: z.number().min(0).max(5),
  masteryThreshold: z.number().min(1).max(10),
  hintMultiplier: z.number().min(0).max(1),
  autoAdvance: z.boolean(),
  autoAdvanceMs: z.number().int().min(0).max(10000),
  audioEnabled: z.boolean(),
  starredOnly: z.boolean(),
  shuffleEnabled: z.boolean(),
  strictness: z.enum(['STRICT', 'NORMAL', 'LENIENT']),
  answerDirection: z.enum(['TERM_TO_DEFINITION', 'DEFINITION_TO_TERM']),
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
    blurb: 'See the term, type the definition',
  },
  {
    value: 'DEFINITION_TO_TERM',
    label: 'Definition → Term',
    blurb: 'See the definition, type the term',
  },
];

const PRESETS: { key: PacePreset; label: string; blurb: string }[] = [
  { key: 'chill', label: 'Chill', blurb: '5 cards, generous mastery' },
  { key: 'default', label: 'Balanced', blurb: '10 cards, standard pace' },
  { key: 'aggressive', label: 'Aggressive', blurb: '15 cards, strict mastery' },
];

export function StudyPreferencesDialog({
  open,
  onOpenChange,
  setId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setId: string;
}) {
  const { data: prefs, isLoading } = useSetPreferences(setId, open);
  const update = useUpdateSetPreferences(setId);
  const applyPreset = useApplyPacePreset(setId);

  return (
    <Dialog open={open} onOpenChange={(next) => !update.isPending && onOpenChange(next)}>
      {/* Cap the dialog at 80vh and lay children out as a column so the
          form body scrolls while the header + footer stay anchored.
          The shadcn default is `grid` — override with `!flex` so the
          layout is deterministic. */}
      <DialogContent className="w-[50vw] max-w-6xl! sm:max-w-6xl! flex! max-h-[85vh] flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Study preferences</DialogTitle>
          <DialogDescription>
            Tune how Learn mode behaves for this set. Changes apply to your next batch — sessions
            already in flight keep the settings they started with.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !prefs ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
          </div>
        ) : (
          <PreferencesForm
            key={`${prefs.batchSize}-${prefs.masteryThreshold}-${prefs.mcWrittenBias}`}
            initial={prefs}
            saving={update.isPending || applyPreset.isPending}
            onApplyPreset={(preset) => applyPreset.mutate(preset)}
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
  onApplyPreset,
  onSave,
  onCancel,
}: {
  initial: SetPreferences;
  saving: boolean;
  onApplyPreset: (preset: PacePreset) => void;
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

  // If the server accepted an apply-preset elsewhere and refetched the
  // query, the parent re-mounts us with a new `key` — this effect
  // covers the softer case where `initial` changes without a remount.
  useEffect(() => {
    reset(initial);
  }, [initial, reset]);

  const audioEnabled = watch('audioEnabled');
  const starredOnly = watch('starredOnly');
  const shuffleEnabled = watch('shuffleEnabled');
  const autoAdvance = watch('autoAdvance');
  const strictness = watch('strictness');
  const answerDirection = watch('answerDirection');

  return (
    <form onSubmit={handleSubmit(onSave)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Scrollable body — fields go here, DialogFooter stays anchored
          below. `min-h-0` on the flex parent + `overflow-y-auto` on
          this child is the standard trick to make an in-flow scroll
          area actually scroll instead of stretching its parent. */}
      <div className="flex-1 space-y-5 overflow-y-auto pr-1">
        {/* Preset row — three buttons that write via the apply-preset
            endpoint. Deliberately separate from the form's own dirty
            state so applying a preset takes effect immediately. */}
        <div className="space-y-2">
          <Label>Pace preset</Label>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.key}
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => onApplyPreset(p.key)}
                className="flex h-auto flex-col items-start gap-0.5 px-3 py-2 text-left"
              >
                <span className="font-semibold text-neutral-900">{p.label}</span>
                <span className="text-xs font-normal text-neutral-500">{p.blurb}</span>
              </Button>
            ))}
          </div>
          <p className="text-xs text-neutral-500">
            Applying a preset overwrites batch size, MC/written bias, mastery threshold, and
            auto-advance timing.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FieldNumber
            id="batchSize"
            label="Batch size"
            hint="Cards per round (1–50)"
            error={errors.batchSize?.message}
            registration={register('batchSize', { valueAsNumber: true })}
          />
          <FieldNumber
            id="mcWrittenBias"
            label="Written bias"
            step={0.1}
            hint="Higher = written prompts sooner"
            error={errors.mcWrittenBias?.message}
            registration={register('mcWrittenBias', { valueAsNumber: true })}
          />
          <FieldNumber
            id="masteryThreshold"
            label="Mastery threshold"
            step={0.5}
            hint="Weighted streak to master a card"
            error={errors.masteryThreshold?.message}
            registration={register('masteryThreshold', { valueAsNumber: true })}
          />
          <FieldNumber
            id="hintMultiplier"
            label="Hint credit"
            step={0.05}
            hint="Credit multiplier when hint used"
            error={errors.hintMultiplier?.message}
            registration={register('hintMultiplier', { valueAsNumber: true })}
          />
        </div>

        {/* Session composition — which cards go into the batch and in
          what order. Direction lives here too since it changes what
          the learner sees on every card. */}
        <div className="space-y-3 rounded-2xl border border-black/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Session</p>

          <SegmentedRow
            label="Answer direction"
            description="Which side you produce."
            options={DIRECTION_OPTIONS}
            value={answerDirection}
            onChange={(v) => setValue('answerDirection', v, { shouldDirty: true })}
          />

          <ToggleRow
            label="Starred cards only"
            description="Restrict the batch to cards you've starred. If you haven't starred any, the session shows an empty state."
            value={starredOnly}
            onChange={(v) => setValue('starredOnly', v, { shouldDirty: true })}
          />

          <ToggleRow
            label="Shuffle cards"
            description="When off, cards appear in their original order. When on, the batch mixes LEARNING first, shuffled within each group."
            value={shuffleEnabled}
            onChange={(v) => setValue('shuffleEnabled', v, { shouldDirty: true })}
          />
        </div>

        {/* Evaluator strictness — how forgiving the written-answer check is. */}
        <SegmentedRow
          label="Grading strictness"
          description="How lenient the written-answer check is."
          options={STRICTNESS_OPTIONS}
          value={strictness}
          onChange={(v) => setValue('strictness', v, { shouldDirty: true })}
        />

        {/* Auto-advance controls — the on/off is re-exposed so learners
          can pick between manual "click Next" and hands-off study.
          Delay only matters when auto-advance is on. */}
        <ToggleRow
          label="Auto-advance after correct"
          description="Automatically move to the next card after a correct answer. Wrong answers always wait for a click regardless."
          value={autoAdvance}
          onChange={(v) => setValue('autoAdvance', v, { shouldDirty: true })}
        />
        <FieldNumber
          id="autoAdvanceMs"
          label="Auto-advance delay (ms)"
          step={100}
          hint="How long a correct-answer feedback stays before advancing"
          disabled={!autoAdvance}
          error={errors.autoAdvanceMs?.message}
          registration={register('autoAdvanceMs', { valueAsNumber: true })}
        />

        <ToggleRow
          label="Voice over (TTS)"
          description="Text-to-speech playback for term and definition. Coming soon — the toggle saves for when it ships."
          value={audioEnabled}
          onChange={(v) => setValue('audioEnabled', v, { shouldDirty: true })}
        />
      </div>

      {/* Footer sits outside the scroll region so Cancel + Save
          remain visible no matter how far the learner has scrolled. */}
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

function FieldNumber({
  id,
  label,
  hint,
  step,
  disabled,
  error,
  registration,
}: {
  id: string;
  label: string;
  hint: string;
  step?: number;
  disabled?: boolean;
  error?: string;
  registration: ReturnType<ReturnType<typeof useForm<PreferencesForm>>['register']>;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" step={step ?? 1} disabled={disabled} {...registration} />
      <p className="text-xs text-neutral-500">{hint}</p>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
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
        active ? 'bg-brand-500 text-white' : 'bg-white text-neutral-500 hover:bg-neutral-100',
      )}
    >
      {children}
    </button>
  );
}

/**
 * Segmented control for enum-shaped preferences (strictness tier,
 * answer direction). Renders one card per option — the active option
 * gets the brand accent + subtle scale. Each option carries a short
 * blurb so learners don't have to guess what "Lenient" means.
 */
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
      <div className={cn('grid gap-2', options.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
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
            <p className="text-sm font-semibold text-neutral-900">{opt.label}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{opt.blurb}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
