import { Skeleton } from '@/components/ui/skeleton';

// Mirrors DiscoverContent's layout: same max-w, same header rhythm, same
// grid so the transition from skeleton → real content doesn't jerk.
export const DiscoverLoading = () => {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-6 sm:px-6 md:py-8">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
        <Skeleton className="h-9 w-56 rounded-full" />
        <Skeleton className="h-5 w-full max-w-md rounded-full" />
      </div>

      <div className="mx-auto flex w-full max-w-2xl gap-2">
        <Skeleton className="h-11 flex-1 rounded-full" />
        <Skeleton className="h-11 w-36 rounded-full" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full rounded-3xl" />
        ))}
      </div>
    </main>
  );
};
