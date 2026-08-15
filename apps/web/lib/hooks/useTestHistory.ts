import { useQuery } from "@tanstack/react-query";

import { getTestHistory, type TestHistoryPage } from "@/lib/api";

export const testHistoryKeys = {
  all: ["test-history"] as const,
  bySet: (setId: string) => [...testHistoryKeys.all, setId] as const,
  paged: (setId: string | undefined, limit: number, offset: number) =>
    [
      ...testHistoryKeys.all,
      setId ?? "all",
      { limit, offset },
    ] as const,
};

/**
 * Paginated Test Mode history for the caller, optionally scoped to a
 * single set. The module page uses this for the "past attempts" list;
 * the review page fetches a single attempt via useTestAttemptResult.
 */
export function useTestHistory(
  params: {
    studySetId?: string;
    limit?: number;
    offset?: number;
    enabled?: boolean;
  } = {},
) {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  return useQuery<TestHistoryPage>({
    queryKey: testHistoryKeys.paged(params.studySetId, limit, offset),
    queryFn: () =>
      getTestHistory({ studySetId: params.studySetId, limit, offset }),
    enabled: params.enabled ?? true,
    staleTime: 30 * 1000,
  });
}
