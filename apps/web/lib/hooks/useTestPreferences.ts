import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getTestPreferences,
  updateTestPreferences,
  type TestPreferences,
  type UpdateTestPreferencesPayload,
} from "@/lib/api";

export const testPreferencesKeys = {
  all: ["test-preferences"] as const,
  byId: (setId: string) => [...testPreferencesKeys.all, setId] as const,
};

/**
 * Read the caller's Test Mode preferences for a set. Falls back to
 * module defaults server-side, so the hook always returns a fully-
 * populated object once loaded — no `undefined` after mount.
 */
export function useTestPreferences(setId: string, enabled = true) {
  return useQuery({
    queryKey: testPreferencesKeys.byId(setId),
    queryFn: () => getTestPreferences(setId),
    enabled: enabled && !!setId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateTestPreferences(setId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateTestPreferencesPayload) =>
      updateTestPreferences(setId, patch),
    onSuccess: (next) => {
      queryClient.setQueryData<TestPreferences>(
        testPreferencesKeys.byId(setId),
        next,
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save test preferences");
    },
  });
}
