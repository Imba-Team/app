"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSrsForecast } from "@/lib/hooks/useSrs";
import { ForecastChart } from "@/app/srs/_components/ForecastChart";

export function ForecastSection() {
  const forecast = useSrsForecast(30);
  const buckets = forecast.data?.buckets ?? [];
  const nothingScheduled =
    !forecast.isLoading && buckets.every((b) => b.dueCount === 0);

  if (nothingScheduled) return null;

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-xl font-bold text-[#4255FF]">Next 30 days</h2>
        <p className="text-xs text-gray-500">Reviews you complete push cards further out.</p>
      </div>
      {forecast.isLoading ? (
        <Skeleton className="h-40 w-full rounded-lg bg-gray-100" />
      ) : (
        <Card>
          <CardContent className="p-4">
            <ForecastChart buckets={buckets} />
          </CardContent>
        </Card>
      )}
    </section>
  );
}
