import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  applyPacePreset,
  getSetPreferences,
  updateSetPreferences,
  type PacePreset,
  type SetPreferences,
  type UpdateSetPreferencesPayload,
} from "@/lib/api";

export const setPreferencesKeys = {
  all: ["set-preferences"] as const,
  byId: (setId: string) => [...setPreferencesKeys.all, setId] as const,
};

/**
 * Read the caller's preferences for a set. Falls back to module defaults
 * server-side, so the hook always returns a fully-populated object once
 * loaded — no `undefined` after mount.
 */
export function useSetPreferences(setId: string, enabled = true) {
  return useQuery({
    queryKey: setPreferencesKeys.byId(setId),
    queryFn: () => getSetPreferences(setId),
    enabled: enabled && !!setId,
    // Preferences don't change from under us — no need to refetch
    // aggressively; the mutations invalidate on write.
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateSetPreferences(setId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateSetPreferencesPayload) =>
      updateSetPreferences(setId, patch),
    onSuccess: (next) => {
      queryClient.setQueryData<SetPreferences>(
        setPreferencesKeys.byId(setId),
        next,
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save preferences");
    },
  });
}

export function useApplyPacePreset(setId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preset: PacePreset) => applyPacePreset(setId, preset),
    onSuccess: (next, preset) => {
      queryClient.setQueryData<SetPreferences>(
        setPreferencesKeys.byId(setId),
        next,
      );
      toast.success(`Applied "${preset}" pace preset`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to apply preset");
    },
  });
}
