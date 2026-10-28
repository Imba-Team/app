"use client";

import { useId, useState } from "react";
import { Plus, Tag as TagIcon, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useTagSuggestions } from "@/lib/hooks/useTags";
import { textLimits } from "@/lib/textLimits";
import { cn } from "@/lib/utils";

const minTagLength = 2;

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Tag chips with type-ahead suggestions (MIM-37). Enter or comma adds the
 * typed tag; picking a suggestion adds it; Backspace on an empty input
 * removes the last chip. Tags are compared case-insensitively.
 */
export function TagInput({
  value,
  onChange,
  id,
  disabled,
  className,
}: TagInputProps) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [highlighted, setHighlighted] = useState("");
  const debounced = useDebouncedValue(query, 200);
  const typed = query.trim();
  const atLimit = value.length >= textLimits.maxTags;
  const has = (name: string) =>
    value.some((t) => t.toLowerCase() === name.toLowerCase());

  const { data: suggestions = [] } = useTagSuggestions(
    debounced,
    focused && debounced.trim().length > 0 && !atLimit,
  );
  // Only show suggestions for what's typed now, not a previous query
  // still in flight or inside the debounce window.
  const fresh = debounced.trim() === typed;
  const options = fresh ? suggestions.filter((s) => !has(s.name)) : [];
  const typedIsValid =
    typed.length >= minTagLength && typed.length <= textLimits.tagName;
  const canAddTyped =
    typedIsValid &&
    !has(typed) &&
    !options.some((s) => s.name.toLowerCase() === typed.toLowerCase());
  const open = focused && typed.length > 0 && (canAddTyped || options.length > 0);

  // cmdk only re-picks the first item when it filters itself; we filter on
  // the server, so keep the highlight on a visible item (else Enter would
  // do nothing after the highlighted item disappears).
  // Existing tags come first so Enter reuses one rather than creating a
  // near-duplicate; "Add …" is last.
  const itemValues = [
    ...options.map((s) => `tag:${s.id}`),
    ...(canAddTyped ? [`add:${typed}`] : []),
  ];
  const activeValue = itemValues.includes(highlighted)
    ? highlighted
    : (itemValues[0] ?? "");

  const add = (raw: string) => {
    const name = raw.trim();
    if (
      name.length < minTagLength ||
      name.length > textLimits.tagName ||
      has(name) ||
      atLimit
    ) {
      return;
    }
    onChange([...value, name]);
    setQuery("");
  };
  const remove = (name: string) => onChange(value.filter((t) => t !== name));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ",") {
      e.preventDefault();
      add(query);
    } else if (e.key === "Backspace" && query === "" && value.length) {
      remove(value[value.length - 1]);
    } else if (e.key === "Escape" && open) {
      e.stopPropagation(); // close the list, not a surrounding dialog
      setQuery("");
    }
    // Enter is handled by the Command root: it picks the highlighted
    // item and stops the surrounding form from submitting.
  };

  const showLengthHint = focused && typed.length > 0 && !typedIsValid;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Command
        shouldFilter={false}
        value={activeValue}
        onValueChange={setHighlighted}
        className="overflow-visible bg-transparent"
      >
        <Popover open={open}>
          <PopoverAnchor asChild>
            <div
              className={cn(
                // Matches the shadcn Input look used across the app.
                "flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-3xl border border-black/5 bg-white px-3 py-1.5 text-sm transition-colors",
                "focus-within:ring-2 focus-within:ring-black/20",
                disabled && "pointer-events-none opacity-50",
              )}
              onClick={() => document.getElementById(inputId)?.focus()}
            >
              {value.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="gap-1 py-0.5 pr-0.5 pl-2 text-xs font-medium"
                >
                  {tag}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-5 rounded-full p-0 hover:bg-black/10"
                    aria-label={`Remove tag ${tag}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(tag);
                    }}
                    disabled={disabled}
                  >
                    <X className="size-3" />
                  </Button>
                </Badge>
              ))}
              {/* A plain input (cmdk's Input overrides `id`, which breaks the
                  label). Arrow keys and Enter still reach the Command root. */}
              <Input
                id={inputId}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                disabled={disabled || atLimit}
                maxLength={textLimits.tagName}
                placeholder={
                  atLimit
                    ? `Up to ${textLimits.maxTags} tags`
                    : value.length
                      ? "Add another tag"
                      : "Add tags, e.g. biology"
                }
                className="h-7 w-auto min-w-32 flex-1 rounded-none border-0 bg-transparent px-1 py-0 focus-visible:ring-0"
                aria-describedby={`${inputId}-hint`}
              />
            </div>
          </PopoverAnchor>
          <PopoverContent
            align="start"
            className="w-(--radix-popover-trigger-width) min-w-56 p-1"
            // Keep focus (and typing) in the input.
            onOpenAutoFocus={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
          >
            <CommandList>
              <CommandGroup>
                {options.map((s) => (
                  <CommandItem
                    key={s.id}
                    value={`tag:${s.id}`}
                    onSelect={() => add(s.name)}
                  >
                    <TagIcon className="size-4" />
                    {s.name}
                  </CommandItem>
                ))}
                {canAddTyped && (
                  <CommandItem value={`add:${typed}`} onSelect={() => add(typed)}>
                    <Plus className="size-4" />
                    Add &ldquo;{typed}&rdquo;
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </PopoverContent>
        </Popover>
      </Command>
      <p id={`${inputId}-hint`} className="text-xs text-neutral-500">
        {showLengthHint
          ? `Tags need ${minTagLength}–${textLimits.tagName} characters.`
          : atLimit
            ? `You've added the maximum of ${textLimits.maxTags} tags.`
            : "Press Enter or comma to add a tag."}
      </p>
    </div>
  );
}
