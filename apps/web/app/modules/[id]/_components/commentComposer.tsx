'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';

// Matches the server DTO (CreateCommentDto / UpdateCommentDto).
export const commentMaxLength = 2000;

const commentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Write something first')
    .max(commentMaxLength, `Keep it under ${commentMaxLength} characters`),
});

type CommentFormValues = z.infer<typeof commentSchema>;

export function CommentComposer({
  placeholder,
  submitLabel,
  pendingLabel = 'Posting…',
  initialValue = '',
  isSubmitting,
  autoFocus,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  submitLabel: string;
  pendingLabel?: string;
  initialValue?: string;
  isSubmitting: boolean;
  autoFocus?: boolean;
  /** Resolve to clear the field (e.g. after posting); reject to keep the draft. */
  onSubmit: (content: string) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const form = useForm<CommentFormValues>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: initialValue },
  });
  const length = useWatch({ control: form.control, name: 'content' })?.length ?? 0;

  const handleSubmit = form.handleSubmit(async ({ content }) => {
    try {
      await onSubmit(content);
      form.reset({ content: '' });
    } catch {
      // The mutation already toasts the error; keep the draft so nothing is lost.
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder={placeholder}
                  aria-label={placeholder}
                  autoFocus={autoFocus}
                  maxLength={commentMaxLength}
                  rows={2}
                  disabled={isSubmitting}
                  onKeyDown={(e) => {
                    // Cmd/Ctrl+Enter posts; plain Enter keeps adding lines.
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleSubmit();
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex items-center justify-end gap-2">
          {length > commentMaxLength - 200 && (
            <span className="mr-auto text-xs text-neutral-500">
              {length}/{commentMaxLength}
            </span>
          )}
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
          <Button type="submit" size="sm" disabled={isSubmitting || length === 0}>
            {isSubmitting ? pendingLabel : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
