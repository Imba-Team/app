"use client";

import { useLibrarySets } from "@/lib/hooks/useLibrary";
import { useRecentStudiedSets } from "@/lib/hooks/useModules";
import { useSrsQueue } from "@/lib/hooks/useSrs";

import { ContinueStudying } from "./ContinueStudying";
import { DashboardLoading } from "./DashboardSkeleton";
import { DiscoverStrip } from "./DiscoverStrip";
import EmptyDashboard from "./EmptyDashboard";
import { ForecastSection } from "./ForecastSection";
import { LibraryPreview } from "./LibraryPreview";
import { SrsHero } from "./SrsHero";

/**
 * Composed dashboard. Five sections (top-down): SRS "today" queue,
 * continue-studying, 30-day forecast, library preview, discover strip.
 * Each section is self-contained (its own loading/empty state), so the
 * page keeps painting even when one query is slow.
 *
 * Sections deliberately excluded here — see docs/Mimir_Roadmap_v2.md:
 * - KPI/streak strip: no analytics endpoint yet (Sprint 9)
 * - Student assignment inbox: no classroom module yet (Sprint 8)
 */
export default function DashboardTab() {
  const recent = useRecentStudiedSets(4);
  const library = useLibrarySets();
  const queue = useSrsQueue(50, 0);

  // Only wait for the *first* paint's data. Once we know the user has
  // *anything* (a study session, a set, or a due card), we can render.
  const stillLoadingBaseline =
    recent.isLoading && library.isLoading && queue.isLoading;

  if (stillLoadingBaseline) {
    return <DashboardLoading />;
  }

  const hasCollection = (library.data?.length ?? 0) > 0;
  const hasStudied = (recent.data?.length ?? 0) > 0;
  const hasQueue = (queue.data?.total ?? 0) > 0;

  // Brand-new user with no modules, no sessions, no queue → welcome hero.
  // As soon as they have *any* activity, we shift to the composed view.
  if (!hasCollection && !hasStudied && !hasQueue) {
    return <EmptyDashboard />;
  }

  return (
    <main className="space-y-8">
      <SrsHero />
      <ContinueStudying />
      <ForecastSection />
      <LibraryPreview />
      <DiscoverStrip />
    </main>
  );
}
