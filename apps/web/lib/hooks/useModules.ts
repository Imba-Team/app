/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getModules,
  getCommunityModules,
  getModuleById,
  createModule,
  updateModule,
  deleteModule,
  collectModule,
  uncollectModule,
  CreateModuleData,
  UpdateModuleData,
} from "@/lib/api";
import { toast } from "sonner";

// ============================================
// QUERY KEYS
// ============================================

export const moduleKeys = {
  all: ["modules"] as const,
  lists: () => [...moduleKeys.all, "list"] as const,
  list: (filters?: string) => [...moduleKeys.lists(), { filters }] as const,
  details: () => [...moduleKeys.all, "detail"] as const,
  detail: (id: string) => [...moduleKeys.details(), id] as const,
  community: () => [...moduleKeys.all, "community"] as const,
};

// ============================================
// QUERIES
// ============================================

export function useModules() {
  return useQuery({
    queryKey: moduleKeys.lists(),
    queryFn: getModules,
  });
}

export function useCommunityModules(q?: string) {
  return useQuery({
    queryKey: [...moduleKeys.community(), { q }],
    queryFn: () => getCommunityModules(q),
  });
}

export function useModule(id: string) {
  return useQuery({
    queryKey: moduleKeys.detail(id),
    queryFn: () => getModuleById(id),
    enabled: !!id,
  });
}

// ============================================
// MUTATIONS
// ============================================

export function useCreateModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateModuleData) => createModule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moduleKeys.lists() });
      toast.success("Module created successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create module");
    },
  });
}

export function useUpdateModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateModuleData }) =>
      updateModule(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: moduleKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: moduleKeys.detail(variables.id),
      });
      toast.success("Module updated successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update module");
    },
  });
}

export function useDeleteModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteModule(id),
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: moduleKeys.lists() });

      // Snapshot the previous value
      const previousModules = queryClient.getQueryData(moduleKeys.lists());

      // Optimistically update to the new value
      queryClient.setQueryData(moduleKeys.lists(), (old: any) => {
        if (!old) return old;
        return old.filter((m: any) => m.id !== id);
      });

      return { previousModules };
    },
    onError: (error: Error, _, context) => {
      // Rollback on error
      if (context?.previousModules) {
        queryClient.setQueryData(moduleKeys.lists(), context.previousModules);
      }
      toast.error(error.message || "Failed to delete module");
    },
    onSuccess: () => {
      toast.success("Module deleted successfully!");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: moduleKeys.lists() });
    },
  });
}

export function useCollectModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => collectModule(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: moduleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: moduleKeys.detail(id) });
      toast.success("Module added to collection");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to collect module");
    },
  });
}

export function useUncollectModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => uncollectModule(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: moduleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: moduleKeys.detail(id) });
      toast.success("Module removed from collection");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to uncollect module");
    },
  });
}
