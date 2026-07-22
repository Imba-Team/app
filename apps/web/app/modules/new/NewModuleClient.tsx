"use client";

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

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Globe,
  Loader2,
  Lock,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useCreateModule } from "@/lib/hooks/useModules";
import { useCreateTerm } from "@/lib/hooks/useTerms";
import { cn } from "@/lib/utils";

// Shared field style — mirrors the AddTerm/TermItem edit form so the
// flashcard rows feel like the same component across the app.
const FIELD_CLASS =
  "w-full min-h-24 px-3 py-2 border border-gray-200 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-[#4255FF]/40 focus:border-[#4255FF] disabled:bg-gray-50 text-base leading-relaxed";

interface DraftCard {
  /** Client-only id for React keys; never sent to the server. */
  key: string;
  term: string;
  definition: string;
}

function makeKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `k${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
}

function makeEmpty(): DraftCard {
  return { key: makeKey(), term: "", definition: "" };
}

export default function NewModuleClient() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
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
      // Never let the list drop below 1 row — the empty state is
      // "one blank row you can start typing in", not "no rows at all".
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

      // Create cards sequentially so orderIndex on the server stays
      // in insertion order. Track failures without blocking — a
      // partial create is better than a full rollback for a user
      // who's just spent 10 minutes drafting.
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
          `${failed} card${failed === 1 ? "" : "s"} couldn't be saved — open the module to retry.`,
        );
      }
      router.push(`/modules/${moduleId}`);
    } catch (err) {
      toast.error((err as Error).message || "Failed to create module");
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8 pb-24">
      <div className="w-full max-w-3xl mx-auto">
        {/* Top nav */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-x-2 text-sm text-gray-500 hover:text-[#4255FF] hover:underline underline-offset-4 transition"
          >
            <ArrowLeft size={16} /> Back to dashboard
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#4255FF]">
            Create a new module
          </h1>
          <p className="text-gray-500 mt-1">
            Add a title, then draft the first few flashcards. You can add
            more later.
          </p>
        </div>

        {/* Module basics */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Module details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="module-title"
                className="text-xs font-medium text-gray-500"
              >
                Title
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                ref={titleRef}
                id="module-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Advanced Biology"
                disabled={saving}
                className="w-full h-11 px-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4255FF]/40 focus:border-[#4255FF] disabled:bg-gray-50 text-base"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="module-description"
                className="text-xs font-medium text-gray-500"
              >
                Description
                <span className="text-gray-400 ml-1 font-normal">
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
                className="w-full px-3 py-2 border border-gray-200 rounded-lg resize-y min-h-20 focus:outline-none focus:ring-2 focus:ring-[#4255FF]/40 focus:border-[#4255FF] disabled:bg-gray-50 text-base leading-relaxed"
              />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-gray-500 block">
                Visibility
              </span>
              <div
                role="radiogroup"
                aria-label="Visibility"
                className="grid grid-cols-2 gap-2"
              >
                <VisibilityOption
                  selected={!isPrivate}
                  onClick={() => setIsPrivate(false)}
                  icon={<Globe size={16} />}
                  label="Public"
                  hint="Anyone can find & save it."
                  disabled={saving}
                />
                <VisibilityOption
                  selected={isPrivate}
                  onClick={() => setIsPrivate(true)}
                  icon={<Lock size={16} />}
                  label="Private"
                  hint="Only you can see it."
                  disabled={saving}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Flashcards */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Flashcards</CardTitle>
              <p className="text-xs text-gray-500 mt-1">
                {filledCards.length} of {cards.length} filled — empty rows
                are skipped.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
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
            <Button
              type="button"
              variant="outline"
              onClick={addCard}
              disabled={saving}
              className="w-full h-11 border-dashed"
            >
              <Plus size={16} className="mr-1" />
              Add another card
            </Button>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-gray-500">
            {title.trim() ? (
              <>
                Creating <span className="font-medium">{title.trim()}</span>{" "}
                with {filledCards.length}{" "}
                {filledCards.length === 1 ? "flashcard" : "flashcards"}.
              </>
            ) : (
              "Title is required."
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
                  <Loader2 size={16} className="mr-1 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create module"
              )}
            </Button>
          </div>
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
        "text-left rounded-lg border p-3 transition-colors",
        selected
          ? "border-[#4255FF] bg-[#4255FF]/5 text-[#4255FF]"
          : "border-gray-200 hover:border-gray-300 text-gray-700",
        disabled && "opacity-60 cursor-not-allowed",
      )}
    >
      <div className="flex items-center gap-2 font-medium">
        {icon}
        {label}
      </div>
      <div className="text-xs text-gray-500 mt-1">{hint}</div>
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
    // Enter jumps to the definition of the same row (Quizlet convention).
    // Shift+Enter is a soft newline in case the term itself spans lines.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      defRef.current?.focus();
    }
  };

  const handleDefKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter on the definition of the last row appends a new empty row
    // (rapid-entry). On non-last rows, just move to the next term.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onAppendIfLast();
      // Focus is transferred in the next render; use a microtask.
      queueMicrotask(() => {
        const next = document.querySelector<HTMLTextAreaElement>(
          `[data-card-term="${index + 1}"]`,
        );
        next?.focus();
      });
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 p-4 space-y-3 bg-white">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-gray-400">
          #{(index + 1).toString().padStart(2, "0")}
        </span>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled || !canRemove}
          aria-label="Remove card"
          className={cn(
            "p-1 rounded-md text-gray-400",
            canRemove && !disabled && "hover:bg-red-50 hover:text-red-600",
            !canRemove && "opacity-30 cursor-not-allowed",
          )}
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Term</label>
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
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">
            Definition
          </label>
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
