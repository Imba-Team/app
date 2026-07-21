"use client";

import { useEffect, useRef, useState } from "react";
import { Star, MoreHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Kept in sync with AddTerm — matching class means the inline editor
// looks and behaves identically to the "Add term" form.
const EDIT_FIELD_CLASS =
  "w-full min-h-24 px-3 py-2 border border-gray-200 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-[#4255FF]/40 focus:border-[#4255FF] disabled:bg-gray-50 text-base leading-relaxed";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

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
const STATUS_STYLES: Record<
  string,
  { dot: string; label: string; badge: string }
> = {
  completed: {
    dot: "bg-emerald-500",
    label: "Mastered",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  in_progress: {
    dot: "bg-amber-500",
    label: "Learning",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
  },
  not_started: {
    dot: "bg-gray-300",
    label: "New",
    badge: "bg-gray-100 text-gray-600 border-gray-200",
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

  const canSave =
    editTermValue.trim().length > 0 && editDefValue.trim().length > 0;

  const handleSaveEdit = () => {
    if (!canSave) return;
    onSaveEdit(term.id, editTermValue.trim(), editDefValue.trim());
    setIsEditing(false);
  };

  // Mirrors AddTerm: Enter in Term advances to Definition; Enter in
  // Definition submits; Shift+Enter is a newline; Ctrl/⌘+Enter always
  // submits; Escape cancels.
  const handleTermKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) handleSaveEdit();
      else editDefRef.current?.focus();
    } else if (e.key === "Escape") {
      setIsEditing(false);
    }
  };

  const handleDefKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === "Escape") {
      setIsEditing(false);
    }
  };

  const status = STATUS_STYLES[term.status ?? "not_started"] ?? STATUS_STYLES.not_started;

  return (
    <Card className="bg-white rounded-2xl w-full flex p-4 items-center flex-row gap-3">
      {/* Status pill */}
      <div
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium shrink-0",
          status.badge,
        )}
        title={`Mastery: ${status.label}`}
        aria-label={`Mastery: ${status.label}`}
      >
        <span className={cn("size-2 rounded-full", status.dot)} />
        {status.label}
      </div>

      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label
                  htmlFor={`edit-term-${term.id}`}
                  className="text-xs font-medium text-gray-500"
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
                  className={EDIT_FIELD_CLASS}
                  placeholder="Term"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor={`edit-def-${term.id}`}
                  className="text-xs font-medium text-gray-500"
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
                  className={EDIT_FIELD_CLASS}
                  placeholder="Explanation (Shift+Enter for a new line)"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                <span>
                  <kbd className="font-mono border border-gray-300 rounded px-1">
                    Enter
                  </kbd>{" "}
                  save
                </span>
                <span>
                  <kbd className="font-mono border border-gray-300 rounded px-1">
                    Shift+Enter
                  </kbd>{" "}
                  new line
                </span>
                <span>
                  <kbd className="font-mono border border-gray-300 rounded px-1">
                    Esc
                  </kbd>{" "}
                  cancel
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveEdit} disabled={!canSave}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-3 min-w-0">
              <div className="font-semibold text-base sm:text-lg truncate">
                {term.term}
              </div>
              <div className="w-px bg-gray-200 shrink-0" />
              <div className="text-gray-700 text-base sm:text-lg truncate">
                {term.definition}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {isCollected && (
                <Button
                  onClick={onToggleStar}
                  variant="ghost"
                  size="icon"
                  aria-label={term.isStarred ? "Remove star" : "Add star"}
                  aria-pressed={term.isStarred}
                >
                  <Star
                    className={cn(
                      "size-5 transition-colors",
                      term.isStarred
                        ? "text-yellow-400 fill-yellow-400"
                        : "text-gray-300 hover:text-gray-500",
                    )}
                  />
                </Button>
              )}

              {isOwned && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Term actions">
                      <MoreHorizontal className="text-gray-500 size-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Term</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleStartEditing}>
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600" onClick={onDelete}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
