import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getInflightLearnSession, type BatchStudyMode, type InflightSession } from '@/lib/api';

export const inflightSessionKeys = {
  all: ['inflight-session'] as const,
  learn: (setId: string, mode: BatchStudyMode = 'LEARN') =>
    [...inflightSessionKeys.all, mode, setId] as const,
};

/**
 * Look up the caller's in-flight LEARN session for a set. Returns
 * `null` when nothing is in flight — the resume-dialog gating on the
 * Learn entry page reads this directly. Fetch is intentionally fresh
 * (`staleTime: 0`) so entering the page always shows the current
 * state; the query is cheap on the server.
 */
export function useInflightLearnSession(
  setId: string,
  enabled = true,
  mode: BatchStudyMode = 'LEARN',
) {
  return useQuery<InflightSession | null>({
    queryKey: inflightSessionKeys.learn(setId, mode),
    queryFn: () => getInflightLearnSession(setId, mode),
    enabled: enabled && !!setId,
    staleTime: 0,
    // The lookup is a UX gate — don't refetch on window focus, otherwise
    // clicking away and back could quietly wipe a "resume" state.
    refetchOnWindowFocus: false,
  });
}

export function useInvalidateInflightLearnSession() {
  const queryClient = useQueryClient();
  return (setId: string, mode: BatchStudyMode = 'LEARN') =>
    queryClient.invalidateQueries({
      queryKey: inflightSessionKeys.learn(setId, mode),
    });
}
