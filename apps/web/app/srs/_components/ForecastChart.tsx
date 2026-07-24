"use client";

import type { SrsForecast } from "@/lib/api";

type Bucket = SrsForecast["buckets"][number];

interface Props {
  buckets: Bucket[];
}

/**
 * Small CSS-only bar chart. Deliberately no charting library — the
 * forecast is a fixed 30-bar view and doesn't need tooltips or zoom.
 */
export function ForecastChart({ buckets }: Props) {
  const maxCount = buckets.reduce((m, b) => Math.max(m, b.dueCount), 0);

  if (buckets.length === 0) {
    return (
      <p className="text-sm text-gray-500">No cards scheduled yet.</p>
    );
  }

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-4">
      <div className="flex h-32 items-end gap-1">
        {buckets.map((b, i) => {
          const heightPct =
            maxCount === 0 ? 0 : Math.max(4, (b.dueCount / maxCount) * 100);
          const isToday = i === 0;
          return (
            <div
              key={b.date}
              className="group relative flex-1"
              title={`${b.date}: ${b.dueCount} due`}
            >
              <div
                className={`w-full rounded-sm ${
                  isToday
                    ? "bg-[#4255FF]"
                    : b.dueCount > 0
                      ? "bg-[#4255FF]/50"
                      : "bg-gray-100"
                }`}
                style={{ height: `${heightPct}%` }}
              />
              {isToday && (
                <span className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-medium text-[#4255FF]">
                  today
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-gray-400">
        <span>{buckets[0]?.date}</span>
        <span>{buckets[buckets.length - 1]?.date}</span>
      </div>
    </div>
  );
}
