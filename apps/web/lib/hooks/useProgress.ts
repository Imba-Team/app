"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getMyProgress, type ProgressRange } from "@/lib/api";

export const progressKeys = {
  all: ["progress"] as const,
  me: (days: ProgressRange) => [...progressKeys.all, "me", { days }] as const,
};

/** Streak, daily activity, mastery history and retention for the caller. */
export function useMyProgress(days: ProgressRange = 30) {
  return useQuery({
    queryKey: progressKeys.me(days),
    queryFn: () => getMyProgress(days),
    // The server caches for a minute too; no point refetching sooner.
    staleTime: 60_000,
    // Switching 30 ↔ 90 keeps the current charts up instead of a skeleton.
    placeholderData: keepPreviousData,
  });
}
