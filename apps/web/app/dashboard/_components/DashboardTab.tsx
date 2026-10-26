"use client";

import { useLibrarySets } from "@/lib/hooks/useLibrary";
import { usePopularPublicSets, useRecentStudiedSets } from "@/lib/hooks/useModules";
import { useSrsForecast, useSrsQueue } from "@/lib/hooks/useSrs";

import { ContinueStudying } from "./ContinueStudying";
import { DashboardLoading } from "./DashboardSkeleton";
import { DiscoverStrip, discoverSetLimit } from "./DiscoverStrip";
import EmptyDashboard from "./EmptyDashboard";
import { ForecastSection } from "./ForecastSection";
import { LibraryPreview } from "./LibraryPreview";
import { SrsHero } from "./SrsHero";

/**
 * Composed dashboard. Five sections (top-down): SRS "today" queue,
 * continue-studying, 30-day forecast, library preview, discover strip.
 * Continue-studying, forecast and discover are hidden when empty, so the
 * page waits for every query that decides which sections exist and renders
 * the final layout once — no section title flashes in and then disappears.
 *
 * Sections deliberately excluded here — see docs/Mimir_Roadmap_v2.md:
 * - KPI/streak strip: no analytics endpoint yet (Sprint 9)
 * - Student assignment inbox: no classroom module yet (Sprint 8)
 */
export default function DashboardTab() {
  // Each call mirrors the arguments its section uses, so the section reads
  // the same cached result instead of firing a second request.
  const recent = useRecentStudiedSets(3);
  const library = useLibrarySets();
  const queue = useSrsQueue(50, 0);
  const forecast = useSrsForecast(30);
  const popular = usePopularPublicSets(discoverSetLimit);

  // A pending query has no data yet, which must not read as "empty". Wait
  // until every query that decides the layout has settled.
  const isSettled = [recent, library, queue, forecast, popular].every((q) => !q.isPending);

  if (!isSettled) {
    return <DashboardLoading />;
  }

  const hasCollection = (library.data?.length ?? 0) > 0;
  const hasStudied = (recent.data?.length ?? 0) > 0;
  const hasQueue = (queue.data?.total ?? 0) > 0;
  const hasActivity = hasCollection || hasStudied || hasQueue;
  const hasForecast = (forecast.data?.buckets ?? []).some((b) => b.dueCount > 0);
  const hasPopular = (popular.data?.length ?? 0) > 0;

  // Brand-new user: all three loaded successfully and came back empty. If a
  // query failed instead, fall through so each section shows its own error.
  const isConfirmedEmpty = recent.isSuccess && library.isSuccess && queue.isSuccess;

  if (!hasActivity && isConfirmedEmpty) {
    return <EmptyDashboard />;
  }

  return (
    <main className="space-y-8">
      <SrsHero />
      {hasStudied && <ContinueStudying />}
      {hasForecast && <ForecastSection />}
      <LibraryPreview />
      {hasPopular && <DiscoverStrip />}
    </main>
  );
}
