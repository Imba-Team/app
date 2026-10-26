'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ModuleComment } from '@/lib/api';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import {
  useCommentReplies,
  useDeleteComment,
  useEditComment,
  usePostComment,
} from '@/lib/hooks/useComments';

import { CommentComposer } from './commentComposer';

export interface CommentPermissions {
  currentUserId?: string;
  /** Module owners can delete (moderate) anyone's comment on their module. */
  canModerate: boolean;
}

export function CommentItem({
  moduleId,
  comment,
  permissions,
  isReply = false,
}: {
  moduleId: string;
  comment: ModuleComment;
  permissions: CommentPermissions;
  isReply?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isThreadOpen, setIsThreadOpen] = useState(false);
  const [isReplying, setIsReplying] = useState(false);

  const editComment = useEditComment(moduleId);
  const deleteComment = useDeleteComment(moduleId);
  const postReply = usePostComment(moduleId);

  const author = comment.author;
  const isOwn = !!author && author.id === permissions.currentUserId;
  const canEdit = !comment.isDeleted && isOwn;
  const canDelete = !comment.isDeleted && (isOwn || permissions.canModerate);
  const isEdited =
    new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() > 1000;
  const name = author?.name || 'Unknown';

  return (
    <article className="flex gap-3">
      <Avatar className={isReply ? 'size-7' : 'size-9'}>
        {author?.profilePicture && (
          <AvatarImage src={author.profilePicture} alt="" className="object-cover" />
        )}
        <AvatarFallback className="text-xs">
          {comment.isDeleted ? '–' : name.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm">
            {comment.isDeleted ? (
              <span className="text-neutral-500">Deleted comment</span>
            ) : (
              <span className="font-semibold text-neutral-900">{name}</span>
            )}
            <span className="text-neutral-500">
              {' · '}
              <time
                dateTime={comment.createdAt}
                title={new Date(comment.createdAt).toLocaleString()}
              >
                {formatRelativeTime(comment.createdAt)}
              </time>
              {isEdited && !comment.isDeleted && ' · edited'}
            </span>
          </p>

          {(canEdit || canDelete) && !isEditing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto size-7"
                  aria-label={`Actions for ${name}'s comment`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <DropdownMenuItem onSelect={() => setIsEditing(true)}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setIsConfirmingDelete(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {isEditing ? (
          <div className="mt-2">
            <CommentComposer
              placeholder="Edit your comment"
              submitLabel="Save"
              pendingLabel="Saving…"
              initialValue={comment.content}
              isSubmitting={editComment.isPending}
              autoFocus
              onSubmit={async (content) => {
                await editComment.mutateAsync({ commentId: comment.id, content });
                setIsEditing(false);
              }}
              onCancel={() => setIsEditing(false)}
            />
          </div>
        ) : (
          // Plain text only (no markdown or links); keep the author's line breaks.
          <p
            className={
              comment.isDeleted
                ? 'mt-0.5 text-sm italic text-neutral-400'
                : 'mt-0.5 whitespace-pre-wrap break-words text-sm text-neutral-800'
            }
          >
            {comment.isDeleted ? 'This comment was deleted.' : comment.content}
          </p>
        )}

        {!isReply && (
          <div className="mt-1.5 flex items-center gap-3 text-sm">
            {!comment.isDeleted && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 font-medium text-neutral-500 hover:text-neutral-900"
                onClick={() => {
                  setIsReplying(true);
                  setIsThreadOpen(true);
                }}
              >
                Reply
              </Button>
            )}
            {comment.replyCount > 0 && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto gap-1 p-0 font-medium text-brand-600 hover:text-neutral-900"
                aria-expanded={isThreadOpen}
                onClick={() => setIsThreadOpen((open) => !open)}
              >
                {isThreadOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {isThreadOpen
                  ? 'Hide replies'
                  : `View ${comment.replyCount} ${comment.replyCount === 1 ? 'reply' : 'replies'}`}
              </Button>
            )}
          </div>
        )}

        {!isReply && isThreadOpen && (
          <CommentThread
            moduleId={moduleId}
            commentId={comment.id}
            permissions={permissions}
            hasReplies={comment.replyCount > 0}
          />
        )}

        {!isReply && isReplying && (
          <div className="mt-3">
            <CommentComposer
              placeholder={`Reply to ${name}…`}
              submitLabel="Reply"
              isSubmitting={postReply.isPending}
              autoFocus
              onSubmit={async (content) => {
                await postReply.mutateAsync({ content, parentCommentId: comment.id });
                setIsReplying(false);
                setIsThreadOpen(true);
              }}
              onCancel={() => setIsReplying(false)}
            />
          </div>
        )}
      </div>

      <Dialog open={isConfirmingDelete} onOpenChange={setIsConfirmingDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this comment?</DialogTitle>
            <DialogDescription>
              {comment.replyCount > 0
                ? 'Its replies stay visible under a "deleted comment" placeholder.'
                : "This can't be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsConfirmingDelete(false)}
              disabled={deleteComment.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteComment.isPending}
              onClick={() =>
                deleteComment.mutate(comment.id, { onSuccess: () => setIsConfirmingDelete(false) })
              }
            >
              {deleteComment.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function CommentThread({
  moduleId,
  commentId,
  permissions,
  hasReplies,
}: {
  moduleId: string;
  commentId: string;
  permissions: CommentPermissions;
  hasReplies: boolean;
}) {
  const replies = useCommentReplies(moduleId, commentId, hasReplies);

  if (!hasReplies) return null;

  return (
    <div className="mt-3 flex flex-col gap-4 border-l-2 border-black/5 pl-4">
      {replies.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin text-neutral-400" aria-label="Loading replies" />
      ) : replies.isError ? (
        <p className="text-sm text-rose-600">
          Couldn&apos;t load replies.{' '}
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-rose-600"
            onClick={() => replies.refetch()}
          >
            Try again
          </Button>
        </p>
      ) : (
        replies.data.items.map((reply) => (
          <CommentItem
            key={reply.id}
            moduleId={moduleId}
            comment={reply}
            permissions={permissions}
            isReply
          />
        ))
      )}
    </div>
  );
}
