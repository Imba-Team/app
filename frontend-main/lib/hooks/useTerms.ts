import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTermsByModuleId,
  createTerm,
  updateTerm,
  deleteTerm,
  getTermProgress,
  updateTermProgress,
  CreateTermData,
  UpdateTermData,
  Term,
  updateTermStatus,
} from "@/lib/api";
import { toast } from "sonner";
import { TermProgress } from "@/app/modules/[id]/types";
import { moduleKeys } from "./useModules";

// ============================================
// QUERY KEYS
// ============================================

export const termKeys = {
  all: ["terms"] as const,
  lists: () => [...termKeys.all, "list"] as const,
  list: (moduleId: string) => [...termKeys.lists(), moduleId] as const,
  details: () => [...termKeys.all, "detail"] as const,
  detail: (id: string) => [...termKeys.details(), id] as const,
  progress: (id: string) => [...termKeys.all, "progress", id] as const,
};

// ============================================
// QUERIES
// ============================================

export function useTerms(moduleId: string) {
  return useQuery({
    queryKey: termKeys.list(moduleId),
    queryFn: () => getTermsByModuleId(moduleId),
    enabled: !!moduleId,
  });
}

export function useTermProgress(termId: string) {
  return useQuery({
    queryKey: termKeys.progress(termId),
    queryFn: () => getTermProgress(termId),
    enabled: !!termId,
  });
}

// ============================================
// MUTATIONS
// ============================================

export function useCreateTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTermData) => createTerm(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: termKeys.list(variables.moduleId),
      });
      toast.success("Term created successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create term");
    },
  });
}

export function useUpdateTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTermData }) =>
      updateTerm(id, data),
    onMutate: async ({ id, data }) => {
      // Find the module this term belongs to
      const queryCache = queryClient.getQueryCache();
      const termQueries = queryCache.findAll({ queryKey: termKeys.lists() });

      let moduleId: string | null = null;
      let previousTerms: Term[] | null = null;

      // Find which module query contains this term
      for (const query of termQueries) {
        const terms = query.state.data as Term[];
        if (terms && terms.some((t) => t.id === id)) {
          moduleId = query.queryKey[2] as string;
          previousTerms = terms;
          break;
        }
      }

      if (moduleId) {
        await queryClient.cancelQueries({ queryKey: termKeys.list(moduleId) });

        // Optimistically update
        queryClient.setQueryData(
          termKeys.list(moduleId),
          (old: Term[] | undefined) => {
            if (!old) return old;
            return old.map((t) => (t.id === id ? { ...t, ...data } : t));
          }
        );

        return { moduleId, previousTerms };
      }

      return { moduleId: null, previousTerms: null };
    },
    onError: (error: Error, _, context) => {
      if (context?.moduleId && context?.previousTerms) {
        queryClient.setQueryData(
          termKeys.list(context.moduleId),
          context.previousTerms
        );
      }
      toast.error(error.message || "Failed to update term");
    },
    onSuccess: (_, variables, context) => {
      if (context?.moduleId) {
        queryClient.invalidateQueries({
          queryKey: termKeys.list(context.moduleId),
        });
      }
      toast.success("Term updated successfully!");
    },
  });
}

export function useDeleteTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTerm(id),
    onMutate: async (id) => {
      // Find the module this term belongs to
      const queryCache = queryClient.getQueryCache();
      const termQueries = queryCache.findAll({ queryKey: termKeys.lists() });

      let moduleId: string | null = null;
      let previousTerms: Term[] | null = null;

      for (const query of termQueries) {
        const terms = query.state.data as Term[];
        if (terms && terms.some((t) => t.id === id)) {
          moduleId = query.queryKey[2] as string;
          previousTerms = terms;
          break;
        }
      }

      if (moduleId) {
        await queryClient.cancelQueries({ queryKey: termKeys.list(moduleId) });

        // Optimistically remove
        queryClient.setQueryData(
          termKeys.list(moduleId),
          (old: Term[] | undefined) => {
            if (!old) return old;
            return old.filter((t) => t.id !== id);
          }
        );

        return { moduleId, previousTerms };
      }

      return { moduleId: null, previousTerms: null };
    },
    onError: (error: Error, _, context) => {
      if (context?.moduleId && context?.previousTerms) {
        queryClient.setQueryData(
          termKeys.list(context.moduleId),
          context.previousTerms
        );
      }
      toast.error(error.message || "Failed to delete term");
    },
    onSuccess: (_, __, context) => {
      if (context?.moduleId) {
        queryClient.invalidateQueries({
          queryKey: termKeys.list(context.moduleId),
        });
      }
      toast.success("Term deleted successfully!");
    },
  });
}

export function useUpdateTermProgress(moduleId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { status?: TermProgress["status"]; isStarred?: boolean };
    }) => updateTermProgress(id, data),
    onSuccess: (_, variables) => {
      if (moduleId) {
        queryClient.invalidateQueries({
          queryKey: termKeys.progress(variables.id),
        });
        queryClient.invalidateQueries({
          queryKey: moduleKeys.detail(moduleId),
        });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update progress");
    },
  });
}

export function useUpdateTermStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, success }: { id: string; success: boolean }) =>
      updateTermStatus(id, success),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: termKeys.progress(variables.id),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update term status");
    },
  });
}
