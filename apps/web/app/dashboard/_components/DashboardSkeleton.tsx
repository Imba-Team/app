import { Skeleton } from "@/components/ui/skeleton";

// Deliberately neutral: no section titles. Which sections render isn't known
// until the data arrives, so the placeholder must not promise any of them.
export const DashboardLoading = () => {
  return (
    <div className="space-y-8" aria-busy="true">
      <Skeleton className="h-40 w-full rounded-2xl bg-gray-100" />
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-6 w-40 rounded-md bg-gray-100" />
          <Skeleton className="h-40 w-full rounded-lg bg-gray-100" />
        </div>
      ))}
    </div>
  );
};
