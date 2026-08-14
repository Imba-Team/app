import { useQuery } from "@tanstack/react-query";

import { getDueQueueForSet, type SrsQueuePage } from "@/lib/api";

export const dueQueueKeys = {
  all: ["due-queue"] as const,
  bySet: (setId: string) => [...dueQueueKeys.all, setId] as const,
};

/**
 * How many SRS cards are due today for this set. Powers the "N due
 * today" affordance on the module page and the enabled state of the
 * "Review due" button on the mode chooser.
 *
 * Deliberately cheap: only fetches the top 50 cards (server-side cap)
 * because the UI only ever needs the count and never renders the
 * items directly. Refetch-on-focus so the count freshens when the
 * learner comes back from a review session.
 */
export function useDueQueue(setId: string, enabled = true) {
  return useQuery<SrsQueuePage>({
    queryKey: dueQueueKeys.bySet(setId),
    queryFn: () => getDueQueueForSet(setId),
    enabled: enabled && !!setId,
    staleTime: 60 * 1000,
  });
}
