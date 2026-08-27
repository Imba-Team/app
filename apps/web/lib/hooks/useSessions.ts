import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listSessions, revokeSession, type RevokeSessionResult } from '@/lib/api/sessions';

const sessionKeys = {
  all: ['auth', 'sessions'] as const,
  list: () => [...sessionKeys.all, 'list'] as const,
};

export function useSessions() {
  return useQuery({
    queryKey: sessionKeys.list(),
    queryFn: listSessions,
    staleTime: 30_000,
  });
}

export function useRevokeSession(options?: {
  onSuccess?: (result: RevokeSessionResult) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: revokeSession,
    onSuccess: async (result) => {
      // Skip refetch when the caller just revoked their own session —
      // subsequent requests will 401 as their access token dies, and
      // the caller-provided onSuccess handles the logout redirect.
      if (!result.wasCurrent) {
        await queryClient.invalidateQueries({ queryKey: sessionKeys.list() });
      }
      options?.onSuccess?.(result);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to revoke session');
    },
  });
}
