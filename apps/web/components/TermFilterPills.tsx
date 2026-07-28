"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MasteryStatus } from "@/lib/api";

/**
 * Mutually-exclusive selection over the /cards/progress server filter.
 * Kept flat as a discriminated string union rather than nesting the
 * server's `{starred, status}` shape — that separation is a server
 * concern; from the UI's view "starred" and "learning" are just
 * different buckets a learner picks between.
 */
export type TermFilterKey =
  | "all"
  | "starred"
  | "new"
  | "in_progress"
  | "mastered";

interface TermFilterPillsProps {
  value: TermFilterKey;
  onChange: (next: TermFilterKey) => void;
  className?: string;
  /** Hide the "Starred" option — used from surfaces that don't support it. */
  starredOnly?: boolean;
  /** Hide status options (New/Learning/Mastered) — starred-only mode. */
  statusOnly?: boolean;
}

interface Option {
  key: TermFilterKey;
  label: string;
  dot?: string;
  icon?: React.ReactNode;
}

const OPTIONS: Option[] = [
  { key: "all", label: "All" },
  {
    key: "starred",
    label: "Starred",
    icon: <Star size={12} className="fill-current" />,
  },
  { key: "new", label: "New", dot: "bg-gray-400" },
  { key: "in_progress", label: "Learning", dot: "bg-amber-500" },
  { key: "mastered", label: "Mastered", dot: "bg-emerald-500" },
];

/**
 * Translate the flat UI key into the {starred, status} shape the API
 * (and useTerms) expects. Kept next to the component so the two stay
 * in sync — if the UI grows a "starred + learning" combined mode, this
 * is the one place to teach it about the additive semantics.
 */
export function toServerFilter(key: TermFilterKey): {
  starred?: boolean;
  status?: MasteryStatus;
} {
  switch (key) {
    case "all":
      return {};
    case "starred":
      return { starred: true };
    case "new":
      return { status: "NEW" };
    case "in_progress":
      return { status: "LEARNING" };
    case "mastered":
      return { status: "MASTERED" };
  }
}

export default function TermFilterPills({
  value,
  onChange,
  className,
  starredOnly = false,
  statusOnly = false,
}: TermFilterPillsProps) {
  const options = OPTIONS.filter((o) => {
    if (o.key === "all") return true;
    if (starredOnly) return o.key === "starred";
    if (statusOnly) return o.key !== "starred";
    return true;
  });

  return (
    <div
      role="radiogroup"
      aria-label="Filter cards"
      className={cn(
        "inline-flex flex-wrap items-center gap-1 rounded-full border border-black/5 bg-white p-1",
        className,
      )}
    >
      {options.map((o) => {
        const selected = value === o.key;
        return (
          <button
            key={o.key}
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              selected
                ? "bg-neutral-900 text-white"
                : "text-neutral-700 hover:bg-black/5",
            )}
          >
            {o.dot && <span className={cn("size-2 rounded-full", o.dot)} />}
            {o.icon && (
              <span
                className={
                  selected ? "text-brand-300" : "text-neutral-400"
                }
              >
                {o.icon}
              </span>
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
