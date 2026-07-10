import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';

interface Props {
  /** Number of skeleton rows to render below the header block. */
  rows?: number;
  className?: string;
}

/**
 * Full-page loading placeholder. Individual features can compose their own
 * skeleton layout; this one is a safe default for any route.
 */
export function LoadingState({ rows = 4, className }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className={cn('flex flex-col gap-4 py-8', className)}
    >
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-1/2" />
      <div className="mt-4 flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
