import * as React from 'react';

import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-16 w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-500 placeholder:text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-black/20 disabled:cursor-not-allowed disabled:opacity-50 resize-y',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
