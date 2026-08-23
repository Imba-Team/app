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

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ChevronDown, Coffee, Loader2, Zap } from 'lucide-react';

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
  audioEnabled: z.boolean(),
  soundEffectsEnabled: z.boolean(),
  starredOnly: z.boolean(),
  shuffleEnabled: z.boolean(),
  strictness: z.enum(['STRICT', 'NORMAL', 'LENIENT']),
  answerDirection: z.enum(['TERM_TO_DEFINITION', 'DEFINITION_TO_TERM', 'MIXED']),
});

type PreferencesForm = z.infer<typeof preferencesSchema>;

const strictnessOptions: {
  value: PreferencesForm['strictness'];
  label: string;
  blurb: string;
}[] = [
  { value: 'STRICT', label: 'Strict', blurb: 'Exact match only' },
  { value: 'NORMAL', label: 'Normal', blurb: 'Accepts typos + variants' },
  { value: 'LENIENT', label: 'Lenient', blurb: 'Extra typo tolerance' },
];

const directionOptions: {
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
  {
    value: 'MIXED',
    label: 'Mixed',
    blurb: 'Random per card — both directions in one session',
  },
];

/**
 * Pace preset copy + icon. The three presets are the primary pace
 * control — advanced knobs sit behind a disclosure below so most
 * learners never see them.
 */
const PRESETS: {
  key: PacePreset;
  label: string;
  blurb: string;
  icon: typeof Coffee;
}[] = [
  { key: 'chill', label: 'Chill', blurb: '5 cards · generous mastery', icon: Coffee },
  {
    key: 'default',
    label: 'Balanced',
    blurb: '10 cards · standard pace',
    icon: undefined as unknown as typeof Coffee,
  },
  { key: 'aggressive', label: 'Aggressive', blurb: '15 cards · strict mastery', icon: Zap },
];

/**
 * Values each preset writes — mirrored from
 * apps/server/src/modules/set-preferences/set-preferences.service.ts
 * so we can detect which preset (if any) matches the current settings
 * and light it up. Keeping this client-side lookup avoids a round-trip
 * for something that only shifts if we intentionally tune the server
 * defaults.
 */
const presetValues: Record<
  PacePreset,
  Pick<PreferencesForm, 'batchSize' | 'mcWrittenBias' | 'masteryThreshold'>
> = {
  chill: { batchSize: 5, mcWrittenBias: 0.5, masteryThreshold: 2 },
  default: { batchSize: 10, mcWrittenBias: 1, masteryThreshold: 3 },
  aggressive: { batchSize: 15, mcWrittenBias: 1.5, masteryThreshold: 4 },
};

function activePresetOf(values: PreferencesForm): PacePreset | null {
  for (const [key, patch] of Object.entries(presetValues)) {
    if (
      values.batchSize === patch.batchSize &&
      values.mcWrittenBias === patch.mcWrittenBias &&
      values.masteryThreshold === patch.masteryThreshold
    ) {
      return key as PacePreset;
    }
  }
  return null;
}

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
  const soundEffectsEnabled = watch('soundEffectsEnabled');
  const starredOnly = watch('starredOnly');
  const shuffleEnabled = watch('shuffleEnabled');
  const autoAdvance = watch('autoAdvance');
  const strictness = watch('strictness');
  const answerDirection = watch('answerDirection');
  const allValues = watch();
  const activePreset = activePresetOf(allValues);

  // Advanced knobs (batch size / bias / threshold / hint credit) sit
  // behind a disclosure — most learners don't need them and the pace
  // preset row covers 90% of the intent. Opens itself when the current
  // values don't match any preset so the learner sees what they've
  // customised.
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(activePreset === null);

  return (
    <form onSubmit={handleSubmit(onSave)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Scrollable body — fields go here, DialogFooter stays anchored
          below. `min-h-0` on the flex parent + `overflow-y-auto` on
          this child is the standard trick to make an in-flow scroll
          area actually scroll instead of stretching its parent. */}
      <div className="flex-1 space-y-5 overflow-y-auto px-3">
        {/* Pace preset pills — the primary pace control. Each pill
            shows the active state so the learner knows which preset
            they're on (or "Custom" when they've tweaked something in
            Advanced). Clicking a pill calls apply-preset which mutates
            the server + refreshes the form. */}
        <div className="space-y-2">
          <Label>Pace preset</Label>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((p) => (
              <PresetPill
                key={p.key}
                preset={p}
                active={activePreset === p.key}
                disabled={saving}
                onClick={() => onApplyPreset(p.key)}
              />
            ))}
          </div>
          <p className="text-xs text-neutral-500">
            {activePreset
              ? `Preset overwrites batch size, MC/written bias, and mastery threshold.`
              : `Custom pace — pick a preset above, or tune individual knobs in Advanced.`}
          </p>
        </div>

        {/* Advanced disclosure — the four numeric knobs that the pace
            preset writes to. Hidden by default because most learners
            never need them. */}
        <div className="rounded-2xl border border-black/10">
          <button
            type="button"
            onClick={() => setAdvancedOpen((prev) => !prev)}
            aria-expanded={advancedOpen}
            className="flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2 text-left hover:bg-neutral-50"
          >
            <span className="text-sm font-semibold text-neutral-800">Advanced</span>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-neutral-500 transition-transform',
                advancedOpen && 'rotate-180',
              )}
            />
          </button>
          {advancedOpen && (
            <div className="grid grid-cols-2 gap-4 border-t border-black/10 p-3">
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
                registration={register('masteryThreshold', {
                  valueAsNumber: true,
                })}
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
          )}
        </div>

        {/* Session composition — which cards go into the batch and in
          what order. Direction lives here too since it changes what
          the learner sees on every card. */}
        <div className="space-y-3 rounded-2xl border border-black/10 p-3">
          <p className="text-xs font-semibold tracking-wide text-neutral-500">Session settings</p>

          <SegmentedRow
            label="Answer direction"
            description="Which side you produce."
            options={directionOptions}
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
          options={strictnessOptions}
          value={strictness}
          onChange={(v) => setValue('strictness', v, { shouldDirty: true })}
        />

        {/* Auto-advance — on/off only. The delay ms lives server-side
            with a hardcoded default now that the UI doesn't expose it. */}
        <ToggleRow
          label="Auto-advance after correct"
          description="Automatically move to the next card after a correct answer. Wrong answers always wait for a click regardless."
          value={autoAdvance}
          onChange={(v) => setValue('autoAdvance', v, { shouldDirty: true })}
        />

        <ToggleRow
          label="Sound effects"
          description="Play a short cue on correct / incorrect answers and a jingle at the end of a set. Coming soon — the toggle saves for when it ships."
          value={soundEffectsEnabled}
          onChange={(v) => setValue('soundEffectsEnabled', v, { shouldDirty: true })}
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

/**
 * Pace-preset pill. Radio-card style: the active preset lights up
 * brand-coloured with a filled label; the others sit muted. Kept
 * outside the react-hook-form registry because pressing a pill
 * dispatches through the apply-preset mutation, not the form's own
 * submit path.
 */
function PresetPill({
  preset,
  active,
  disabled,
  onClick,
}: {
  preset: (typeof PRESETS)[number];
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = preset.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'group relative flex flex-col gap-1 rounded-2xl border p-3 text-left transition-all',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300/40',
        active
          ? 'border-brand-500 bg-brand-500 text-white shadow-sm'
          : 'border-black/10 bg-white hover:border-brand-400 hover:bg-brand-300/10',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className={cn('h-4 w-4', active ? 'text-white' : 'text-neutral-500')} />}
        <span className={cn('text-sm font-semibold', active ? 'text-white' : 'text-neutral-900')}>
          {preset.label}
        </span>
      </div>
      <span className={cn('text-xs', active ? 'text-white/85' : 'text-neutral-500')}>
        {preset.blurb}
      </span>
    </button>
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
