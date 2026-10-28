"use client";

import { useQuery } from "@tanstack/react-query";
import { getTagSuggestions } from "@/lib/api";

export const tagKeys = {
  all: ["tags"] as const,
  suggest: (q: string) => [...tagKeys.all, "suggest", { q }] as const,
};

/** Suggestions for the tag input; pass an already-debounced query. */
export function useTagSuggestions(q: string, enabled = true) {
  const query = q.trim();
  return useQuery({
    queryKey: tagKeys.suggest(query),
    queryFn: () => getTagSuggestions(query || undefined),
    enabled,
    staleTime: 60_000,
  });
}
