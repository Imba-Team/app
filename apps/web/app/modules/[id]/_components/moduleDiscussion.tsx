'use client';

import { MessagesSquare } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useModuleComments, usePostComment } from '@/lib/hooks/useComments';
import { useMe } from '@/lib/hooks/useUser';

import { CommentComposer } from './commentComposer';
import { CommentItem } from './commentItem';

/** The "Discussion" tab on the module page. */
export function ModuleDiscussion({ moduleId, isOwner }: { moduleId: string; isOwner: boolean }) {
  const { data: me } = useMe();
  const comments = useModuleComments(moduleId);
  const postComment = usePostComment(moduleId);

  const items = comments.data?.pages.flatMap((page) => page.items) ?? [];
  const permissions = { currentUserId: me?.id, canModerate: isOwner };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent>
          <CommentComposer
            placeholder="Ask a question or share a tip about this module…"
            submitLabel="Post"
            isSubmitting={postComment.isPending}
            onSubmit={(content) => postComment.mutateAsync({ content })}
          />
        </CardContent>
      </Card>

      {comments.isPending ? (
        <Skeleton aria-busy="true" className="h-40 w-full rounded-3xl bg-neutral-200/70" />
      ) : comments.isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 text-center">
            <p className="font-semibold text-neutral-900">Couldn&apos;t load the discussion.</p>
            <Button size="sm" variant="outline" onClick={() => comments.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <MessagesSquare className="h-8 w-8 text-neutral-400" aria-hidden />
          <p className="font-semibold text-neutral-900">No comments yet</p>
          <p className="text-sm text-neutral-500">
            Start the discussion: ask a question or share a tip.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {items.map((comment) => (
            <CommentItem
              key={comment.id}
              moduleId={moduleId}
              comment={comment}
              permissions={permissions}
            />
          ))}
          {comments.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => comments.fetchNextPage()}
                disabled={comments.isFetchingNextPage}
              >
                {comments.isFetchingNextPage ? 'Loading…' : 'Load more comments'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
