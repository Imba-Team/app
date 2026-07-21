"use client";

import { useQuery } from "@tanstack/react-query";
import { getSessionHistory } from "@/lib/api";

export const sessionHistoryKeys = {
  all: ["session-history"] as const,
  list: (params: { studySetId?: string; limit?: number; offset?: number }) =>
    [...sessionHistoryKeys.all, "list", params] as const,
};

/**
 * Paginated study-session history. `studySetId` is optional — scoped
 * variants power the per-module list, unscoped could power a future
 * global "activity" page.
 */
export function useSessionHistory(params: {
  studySetId?: string;
  limit?: number;
  offset?: number;
} = {}) {
  return useQuery({
    queryKey: sessionHistoryKeys.list(params),
    queryFn: () => getSessionHistory(params),
    // Sessions are immutable once completed; keep the cache warm.
    staleTime: 60_000,
  });
}
