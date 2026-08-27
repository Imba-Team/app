import { Skeleton } from "@/components/ui/skeleton";

export const DashboardLoading = () => {
  return (
    <div className="w-full">
      <div className="mb-8">
        <Skeleton className="h-8 w-48 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-40 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>

      <div className="mb-2">
        <Skeleton className="h-8 w-32 mb-4" />

        <div className="flex gap-4 mb-4 items-center">
          <Skeleton className="h-10 w-15 rounded-lg" />
          <Skeleton className="h-10 flex-1" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
};
