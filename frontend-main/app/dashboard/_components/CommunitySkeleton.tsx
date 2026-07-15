import { Skeleton } from "@/components/ui/skeleton";

export const CommunityLoading = () => {
  return (
    <div className="w-full">
      <div className="mb-8">
        <Skeleton className="h-8 w-56 mb-4 mx-auto" />
        <Skeleton className="h-5 w-96 mb-4 mx-auto" />
        <div className="flex w-full max-w-2xl mx-auto items-center gap-2 mb-10">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-52 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
