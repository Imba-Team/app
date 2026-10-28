"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { languageOptions } from "@/lib/languages";

// Radix Select doesn't allow "" as an item value.
const noLanguage = "__none__";

interface LanguageSelectProps {
  /** The set's language, or "" for none. */
  value: string;
  onChange: (language: string) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Picks a set's language from the shared list, so sets and the Discover
 * filter use the same spelling. A value outside the list (from before the
 * list existed) stays selectable instead of being silently dropped.
 */
export function LanguageSelect({
  value,
  onChange,
  id,
  disabled,
  className,
}: LanguageSelectProps) {
  const isCustom =
    value !== "" && !languageOptions.some((opt) => opt.value === value);

  return (
    <Select
      value={value || noLanguage}
      onValueChange={(v) => {
        // Radix's hidden native <select> reports "" when the value changes
        // while the list is closed (e.g. a form reset). A real choice is
        // never "" — "none" is the sentinel — so ignore it.
        if (v === "") return;
        onChange(v === noLanguage ? "" : v);
      }}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder="No language" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={noLanguage}>No language</SelectItem>
        {isCustom && <SelectItem value={value}>{value}</SelectItem>}
        {languageOptions.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
