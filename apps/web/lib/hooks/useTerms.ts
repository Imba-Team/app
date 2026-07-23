import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTerm,
  updateTerm,
  deleteTerm,
  getTermProgress,
  getTermsWithProgress,
  toggleTermStar,
  CreateTermData,
  UpdateTermData,
  Term,
  type TermsFilter,
} from "@/lib/api";
import { toast } from "sonner";

// ============================================
// QUERY KEYS
// ============================================

/**
 * Serialise a filter into the query key so cached variants don't
 * collide. Missing fields are normalised to `""` so `undefined` vs
 * `{ starred: undefined }` produce the same key. Trimming the search
 * query keeps whitespace-only inputs from creating a distinct cache
 * entry per keystroke.
 */
function filterKey(filter: TermsFilter = {}) {
  return {
    starred: filter.starred === undefined ? "" : filter.starred,
    status: filter.status ?? "",
    q: filter.q?.trim() ?? "",
  };
}

export const termKeys = {
  all: ["terms"] as const,
  lists: () => [...termKeys.all, "list"] as const,
  listsForModule: (moduleId: string) =>
    [...termKeys.lists(), moduleId] as const,
  list: (moduleId: string, filter: TermsFilter = {}) =>
    [...termKeys.listsForModule(moduleId), filterKey(filter)] as const,
  details: () => [...termKeys.all, "detail"] as const,
  detail: (id: string) => [...termKeys.details(), id] as const,
  progress: (id: string) => [...termKeys.all, "progress", id] as const,
};

// ============================================
// QUERIES
// ============================================

export function useTerms(moduleId: string, filter: TermsFilter = {}) {
  return useQuery({
    queryKey: termKeys.list(moduleId, filter),
    // Bulk cards-with-progress so mastery dots + starred state populate
    // in a single request instead of one-per-card lookups. Filter is
    // applied server-side.
    queryFn: () => getTermsWithProgress(moduleId, filter),
    enabled: !!moduleId,
    // Keep the previous list visible while a filter change refetches
    // so the term list doesn't blank out on every toggle.
    placeholderData: (previousData) => previousData,
  });
}

export function useToggleTermStar(moduleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isStarred }: { id: string; isStarred: boolean }) =>
      toggleTermStar(id, isStarred),
    onMutate: async ({ id, isStarred }) => {
      // Cancel + snapshot every cached variant for this module — the
      // learner might have "only starred" and "all" in memory at once.
      await queryClient.cancelQueries({
        queryKey: termKeys.listsForModule(moduleId),
      });
      const previous = queryClient.getQueriesData<Term[]>({
        queryKey: termKeys.listsForModule(moduleId),
      });

      queryClient.setQueriesData<Term[]>(
        { queryKey: termKeys.listsForModule(moduleId) },
        (old) =>
          old ? old.map((t) => (t.id === id ? { ...t, isStarred } : t)) : old,
      );

      return { previous };
    },
    onError: (error: Error, _vars, ctx) => {
      if (ctx?.previous) {
        for (const [key, data] of ctx.previous) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error(error.message || "Failed to update star");
    },
    onSettled: () => {
      // Filtered views may need to re-fetch — an unstarred card should
      // disappear from an "only starred" list, an unstudied newly-
      // starred card should appear.
      queryClient.invalidateQueries({
        queryKey: termKeys.listsForModule(moduleId),
      });
    },
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

/**
 * Walk every list cache for the given module. Filters are keyed
 * separately so a single card can live in {}, {starred:true},
 * {status:LEARNING}, etc. — mutations need to touch all of them.
 */
function findTermInCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  termId: string,
): { moduleId: string | null; snapshots: [readonly unknown[], Term[]][] } {
  const snapshots: [readonly unknown[], Term[]][] = [];
  let moduleId: string | null = null;
  const all = queryClient.getQueryCache().findAll({ queryKey: termKeys.lists() });
  for (const q of all) {
    const data = q.state.data as Term[] | undefined;
    if (!data) continue;
    if (data.some((t) => t.id === termId)) {
      snapshots.push([q.queryKey, data]);
      // Extract moduleId from the key shape:
      //   [ ...termKeys.all, "list", moduleId, filterKey ]
      moduleId = (q.queryKey[2] as string) ?? moduleId;
    }
  }
  return { moduleId, snapshots };
}

export function useCreateTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTermData) => createTerm(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: termKeys.listsForModule(variables.moduleId),
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
      const { moduleId, snapshots } = findTermInCaches(queryClient, id);
      if (!moduleId) return { moduleId: null, snapshots };

      await queryClient.cancelQueries({
        queryKey: termKeys.listsForModule(moduleId),
      });
      queryClient.setQueriesData<Term[]>(
        { queryKey: termKeys.listsForModule(moduleId) },
        (old) =>
          old ? old.map((t) => (t.id === id ? { ...t, ...data } : t)) : old,
      );
      return { moduleId, snapshots };
    },
    onError: (error: Error, _, ctx) => {
      if (ctx?.snapshots) {
        for (const [key, data] of ctx.snapshots) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error(error.message || "Failed to update term");
    },
    onSuccess: (_, __, ctx) => {
      if (ctx?.moduleId) {
        queryClient.invalidateQueries({
          queryKey: termKeys.listsForModule(ctx.moduleId),
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
      const { moduleId, snapshots } = findTermInCaches(queryClient, id);
      if (!moduleId) return { moduleId: null, snapshots };

      await queryClient.cancelQueries({
        queryKey: termKeys.listsForModule(moduleId),
      });
      queryClient.setQueriesData<Term[]>(
        { queryKey: termKeys.listsForModule(moduleId) },
        (old) => (old ? old.filter((t) => t.id !== id) : old),
      );
      return { moduleId, snapshots };
    },
    onError: (error: Error, _, ctx) => {
      if (ctx?.snapshots) {
        for (const [key, data] of ctx.snapshots) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error(error.message || "Failed to delete term");
    },
    onSuccess: (_, __, ctx) => {
      if (ctx?.moduleId) {
        queryClient.invalidateQueries({
          queryKey: termKeys.listsForModule(ctx.moduleId),
        });
      }
      toast.success("Term deleted successfully!");
    },
  });
}

