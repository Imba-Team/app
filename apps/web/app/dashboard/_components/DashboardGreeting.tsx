'use client';

import { useMe } from '@/lib/hooks/useUser';
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardGreeting() {
  const { data: me, isLoading } = useMe();

  if (isLoading) {
    return <Skeleton className="mb-6 h-10 w-72 rounded-lg" />;
  }

  return (
    <h1 className="mb-6 text-3xl font-medium tracking-tight text-neutral-700 sm:text-4xl">
      Welcome in, {me?.name ?? 'there'}
    </h1>
  );
}
