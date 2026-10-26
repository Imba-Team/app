'use client';

import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  type CommentPage,
  type ModuleComment,
  deleteComment,
  editComment,
  getCommentReplies,
  getModuleComments,
  postComment,
} from '@/lib/api';

const pageSize = 20;

export const commentKeys = {
  all: ['comments'] as const,
  module: (moduleId: string) => [...commentKeys.all, moduleId] as const,
  list: (moduleId: string) => [...commentKeys.module(moduleId), 'list'] as const,
  replies: (moduleId: string, commentId: string) =>
    [...commentKeys.module(moduleId), 'replies', commentId] as const,
};

/** Top-level comments, newest first, loaded 20 at a time ("Load more"). */
export function useModuleComments(moduleId: string) {
  return useInfiniteQuery({
    queryKey: commentKeys.list(moduleId),
    queryFn: ({ pageParam }) => getModuleComments(moduleId, pageParam, pageSize),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled: !!moduleId,
  });
}

/** Replies are fetched only once a thread is expanded. */
export function useCommentReplies(moduleId: string, commentId: string, enabled: boolean) {
  return useQuery({
    queryKey: commentKeys.replies(moduleId, commentId),
    queryFn: () => getCommentReplies(moduleId, commentId),
    enabled,
  });
}

// Any write can change counts and visibility across the list and a thread
// (e.g. deleting the last reply hides a deleted parent), so refresh both.
function useInvalidateModuleComments(moduleId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: commentKeys.module(moduleId) });
}

export function usePostComment(moduleId: string) {
  const invalidate = useInvalidateModuleComments(moduleId);
  return useMutation({
    mutationFn: ({ content, parentCommentId }: { content: string; parentCommentId?: string }) =>
      postComment(moduleId, content, parentCommentId),
    onSuccess: () => invalidate(),
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to post comment');
    },
  });
}

export function useEditComment(moduleId: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidateModuleComments(moduleId);
  return useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      editComment(commentId, content),
    onSuccess: (updated) => {
      // Swap the edited comment into every cached list/thread right away so
      // the old text doesn't flash back while the refetch is in flight.
      const swap = (items: ModuleComment[]) =>
        items.map((c) => (c.id === updated.id ? updated : c));
      qc.setQueriesData<InfiniteData<CommentPage> | CommentPage>(
        { queryKey: commentKeys.module(moduleId) },
        (data) => {
          if (!data) return data;
          if ('pages' in data) {
            return { ...data, pages: data.pages.map((p) => ({ ...p, items: swap(p.items) })) };
          }
          return { ...data, items: swap(data.items) };
        },
      );
      invalidate();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to edit comment');
    },
  });
}

export function useDeleteComment(moduleId: string) {
  const invalidate = useInvalidateModuleComments(moduleId);
  return useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: () => {
      invalidate();
      toast.success('Comment deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete comment');
    },
  });
}
