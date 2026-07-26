"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Shared field styles so the Term and Definition inputs render at
// identical size/typography — asymmetry between them makes the form
// feel visually off-balance for a symmetric concept.
const FIELD_CLASS =
  "w-full min-h-24 px-3 py-2 border border-gray-200 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-[#4255FF]/40 focus:border-[#4255FF] disabled:bg-gray-50 text-base leading-relaxed";

interface AddTermProps {
  onSubmit: (term: string, definition: string) => void;
  /**
   * True while the mutation is in flight — keeps the panel open, disables
   * the submit button, and shows a spinner. When it flips back to false
   * (after success), we clear the fields and refocus the term input.
   */
  isSubmitting?: boolean;
}

/**
 * Inline "Add term" panel.
 *
 * Keyboard model:
 *  - `Ctrl+N` / `⌘+N`   → open the panel
 *  - `Enter` in term    → move focus to definition
 *  - `Enter` in def     → submit (with `Shift+Enter` for a newline)
 *  - `Ctrl+Enter`       → submit from either field
 *  - `Escape`           → cancel (but not if the user has typed content)
 *
 * The definition field is a textarea (multi-line answers are common in
 * language study) with `Shift+Enter` for a soft newline. Everything else
 * mirrors what people expect from Anki/Quizlet-style flows.
 */
export default function AddTerm({ onSubmit, isSubmitting = false }: AddTermProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTerm, setNewTerm] = useState("");
  const [newDef, setNewDef] = useState("");
  const termRef = useRef<HTMLTextAreaElement>(null);
  const defRef = useRef<HTMLTextAreaElement>(null);
  const wasSubmittingRef = useRef(false);

  // Global shortcut to open the panel.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        const t = e.target as HTMLElement | null;
        if (
          t &&
          (t.tagName === "INPUT" ||
            t.tagName === "TEXTAREA" ||
            t.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        setIsAdding(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (isAdding) {
      // Small delay so the DOM node exists before focus.
      requestAnimationFrame(() => termRef.current?.focus());
    }
  }, [isAdding]);

  // After a successful submit, clear + refocus so the user can keep going.
  useEffect(() => {
    if (wasSubmittingRef.current && !isSubmitting) {
      setNewTerm("");
      setNewDef("");
      requestAnimationFrame(() => termRef.current?.focus());
    }
    wasSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  const canSubmit = newTerm.trim().length > 0 && newDef.trim().length > 0;

  const submit = () => {
    if (!canSubmit || isSubmitting) return;
    onSubmit(newTerm.trim(), newDef.trim());
  };

  const cancel = () => {
    // Guard against accidental Escape when the user has half-typed a term.
    if (newTerm.trim() || newDef.trim()) {
      if (!window.confirm("Discard this term?")) return;
    }
    setNewTerm("");
    setNewDef("");
    setIsAdding(false);
  };

  if (!isAdding) {
    return (
      <Card
        role="button"
        tabIndex={0}
        onClick={() => setIsAdding(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsAdding(true);
          }
        }}
        className="w-full mt-4 py-4 flex items-center justify-center gap-2 font-medium cursor-pointer hover:text-[#4255FF] transition-colors"
        aria-label="Add new term (Ctrl+N)"
      >
        <Plus size={18} />
        Add new term
        <kbd className="ml-2 hidden sm:inline text-[10px] font-mono border border-gray-300 rounded px-1.5 py-0.5 text-gray-500">
          Ctrl+N
        </kbd>
      </Card>
    );
  }

  return (
    <Card className="w-full mt-4 p-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="new-term" className="text-xs font-medium text-gray-500">
            Term
          </label>
          <textarea
            ref={termRef}
            id="new-term"
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            onKeyDown={(e) => {
              // Term is typically short, so Enter should advance to
              // the Definition field like a single-line input. Users
              // who want a multi-line term can still use Shift+Enter.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (e.ctrlKey || e.metaKey) submit();
                else defRef.current?.focus();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            placeholder="e.g. photosynthesis"
            rows={3}
            disabled={isSubmitting}
            className={FIELD_CLASS}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="new-def" className="text-xs font-medium text-gray-500">
            Definition
          </label>
          <textarea
            ref={defRef}
            id="new-def"
            value={newDef}
            onChange={(e) => setNewDef(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            placeholder="Explanation (Shift+Enter for a new line)"
            rows={3}
            disabled={isSubmitting}
            className={FIELD_CLASS}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
          <span>
            <kbd className="font-mono border border-gray-300 rounded px-1">Enter</kbd>{" "}
            to add
          </span>
          <span>
            <kbd className="font-mono border border-gray-300 rounded px-1">Shift+Enter</kbd>{" "}
            new line
          </span>
          <span>
            <kbd className="font-mono border border-gray-300 rounded px-1">Esc</kbd>{" "}
            cancel
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={cancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={submit}
            disabled={!canSubmit || isSubmitting}
            className="min-w-24"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="mr-1 animate-spin" />
                Adding…
              </>
            ) : (
              <>
                <Plus size={14} className="mr-1" />
                Add term
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
