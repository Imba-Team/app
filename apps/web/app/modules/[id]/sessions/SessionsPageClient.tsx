"use client";

/**
 * Study session history for one module.
 *
 * Renders paginated SessionHistoryItemDto rows from GET /sessions with
 * ?studySetId= — see TDD §11.3. Each row shows mode, timestamp,
 * duration, correct/incorrect counts, and computed accuracy. In-progress
 * sessions (no `completedAt`) are called out separately so learners
 * don't confuse an abandoned session with a completed one.
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Target,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useModule } from "@/lib/hooks/useModules";
import { useSessionHistory } from "@/lib/hooks/useSessionHistory";
import type { SessionHistoryItem } from "@/lib/api";

const PAGE_SIZE = 20;

const MODE_LABEL: Record<SessionHistoryItem["mode"], string> = {
  FLASHCARD: "Flashcards",
  LEARN: "Learn",
  WRITE: "Write",
  SPELL: "Spell",
  TEST: "Test",
  MATCH: "Match",
  AI_FILL_BLANK: "Fill in the blank",
  AI_GUESS_WORD: "Guess the word",
};

const MODE_BADGE: Record<SessionHistoryItem["mode"], string> = {
  FLASHCARD: "bg-[#4255FF]/10 text-[#4255FF] border-[#4255FF]/30",
  LEARN: "bg-emerald-50 text-emerald-700 border-emerald-200",
  WRITE: "bg-amber-50 text-amber-700 border-amber-200",
  SPELL: "bg-cyan-50 text-cyan-700 border-cyan-200",
  TEST: "bg-rose-50 text-rose-700 border-rose-200",
  MATCH: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  AI_FILL_BLANK: "bg-purple-50 text-purple-700 border-purple-200",
  AI_GUESS_WORD: "bg-purple-50 text-purple-700 border-purple-200",
};

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 1) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return `Today, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  if (diffDays === 1) return `Yesterday, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "long", hour: "2-digit", minute: "2-digit" });
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function SessionsPageClient({ moduleId }: { moduleId: string }) {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const { data: moduleData } = useModule(moduleId);
  const { data, isLoading, isError } = useSessionHistory({
    studySetId: moduleId,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const totals = useMemo(() => {
    if (!data) return null;
    // Roll up the visible page. TDD notes analytics live in ClickHouse,
    // so an all-time aggregate belongs in a future dashboard endpoint;
    // for now, summarise the page the user is looking at.
    const summed = data.items.reduce(
      (acc, s) => {
        acc.correct += s.correctAnswers;
        acc.incorrect += s.incorrectAnswers;
        acc.duration += s.durationSeconds;
        return acc;
      },
      { correct: 0, incorrect: 0, duration: 0 },
    );
    const attempts = summed.correct + summed.incorrect;
    return { ...summed, accuracy: attempts === 0 ? 0 : summed.correct / attempts };
  }, [data]);

  return (
    <main className="flex flex-col min-h-screen bg-gray-50 p-8 pb-20">
      <div className="w-full max-w-4xl mx-auto">
        <Link
          href={`/modules/${moduleId}`}
          className="inline-flex items-center gap-x-2 text-sm text-gray-500 hover:text-[#4255FF] hover:underline underline-offset-4 transition mb-6"
        >
          <ArrowLeft size={16} /> Back to module
        </Link>

        <div className="mb-8 flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-[#4255FF]">Session history</h1>
            {moduleData?.data && (
              <p className="text-gray-500 mt-1">
                {moduleData.data.title}
              </p>
            )}
          </div>
          {totals && data && data.items.length > 0 && (
            <div className="text-sm text-gray-500 text-right">
              <p>
                <span className="font-semibold text-gray-800">{data.total}</span>{" "}
                total sessions
              </p>
              <p>
                {Math.round((totals.accuracy ?? 0) * 100)}% accuracy on this page
              </p>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl bg-gray-200" />
            ))}
          </div>
        )}

        {isError && (
          <Card className="bg-rose-50 border-rose-200">
            <CardHeader>
              <CardTitle className="text-rose-700">
                Couldn&apos;t load session history
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => router.refresh()}>
                Try again
              </Button>
            </CardContent>
          </Card>
        )}

        {data && data.items.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>No sessions yet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600">
              <p>
                Study this module with any mode to start building your history.
                Sessions record what you studied, how long you studied, and how
                many cards you got right.
              </p>
              <Button onClick={() => router.push(`/modules/${moduleId}/flashcards`)}>
                Start with Flashcards
              </Button>
            </CardContent>
          </Card>
        )}

        {data && data.items.length > 0 && (
          <>
            <ul className="space-y-3">
              {data.items.map((s) => (
                <SessionRow key={s.sessionId} session={s} />
              ))}
            </ul>

            {data.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <span className="text-sm text-gray-500">
                  Page {data.page} of {data.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={data.page <= 1}
                  >
                    <ChevronLeft size={16} className="mr-1" /> Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={data.page >= data.totalPages}
                  >
                    Next <ChevronRight size={16} className="ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function SessionRow({ session }: { session: SessionHistoryItem }) {
  const label = MODE_LABEL[session.mode] ?? session.mode;
  const badge = MODE_BADGE[session.mode] ?? "bg-gray-100 text-gray-700 border-gray-200";
  const accuracyPct = Math.round((session.accuracy ?? 0) * 100);
  const isInProgress = !session.completedAt;
  const totalAnswers = session.correctAnswers + session.incorrectAnswers;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${badge}`}
          >
            <BookOpen size={12} />
            {label}
          </span>
          {isInProgress ? (
            <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 text-amber-700 px-2 py-0.5 text-xs font-medium">
              In progress
            </span>
          ) : (
            <span className="text-xs text-gray-500">
              {formatWhen(session.completedAt)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Stat
            icon={<Target size={14} className="text-gray-500" />}
            label="Accuracy"
            value={totalAnswers === 0 ? "—" : `${accuracyPct}%`}
          />
          <Stat
            icon={<CheckCircle2 size={14} className="text-emerald-600" />}
            label="Correct"
            value={session.correctAnswers.toString()}
          />
          <Stat
            icon={<XCircle size={14} className="text-rose-600" />}
            label="Incorrect"
            value={session.incorrectAnswers.toString()}
          />
          <Stat
            icon={<Clock size={14} className="text-gray-500" />}
            label="Duration"
            value={formatDuration(session.durationSeconds)}
          />
        </div>

        <div className="mt-3 text-xs text-gray-400">
          Started {formatWhen(session.startedAt)}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        {icon}
        {label}
      </div>
      <div className="font-semibold text-gray-800">{value}</div>
    </div>
  );
}
