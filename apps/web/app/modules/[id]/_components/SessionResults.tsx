"use client";

/**
 * Shared results screen for study modes.
 *
 * Both Flashcards and Learn mode used to render two panels: an
 * intermediate "You went through every card / End of session" screen
 * with a Finish button, and then a separate summary once the server
 * ack'd `POST /sessions/:id/complete`. That extra hop was cognitive
 * dead weight — the learner had already finished when the deck ran
 * out. This component is the single detailed results page both modes
 * render once `finish()` resolves.
 *
 * Feed it the session summary from the server plus the running list
 * of per-card answers so we can compute session-scoped stats
 * (newly-mastered count, hint-used count) that aren't on the summary
 * DTO itself.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  History,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SessionSummary } from "@/lib/api";

interface SessionAnswerLike {
  graduated: boolean;
  hintUsed: boolean;
}

interface SessionResultsProps {
  summary: SessionSummary;
  answers: SessionAnswerLike[];
  moduleId: string;
  /**
   * The route segment for "Study again" — 'flashcards' or 'learn'.
   * Used to build the restart link.
   */
  modeRoute: "flashcards" | "learn";
  /** Optional mastery rollup from the last per-card response. */
  latestProgress?: {
    totalCards: number;
    masteredCount: number;
  } | null;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export default function SessionResults({
  summary,
  answers,
  moduleId,
  modeRoute,
  latestProgress,
}: SessionResultsProps) {
  const router = useRouter();
  const accuracyPct = Math.round((summary.accuracy ?? 0) * 100);
  const newlyMastered = answers.filter((a) => a.graduated).length;
  const hintUsedCount = answers.filter((a) => a.hintUsed).length;

  return (
    <main className="min-h-screen bg-gray-100 flex items-start justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center rounded-full bg-amber-100 p-3 mb-3">
            <Trophy size={28} className="text-amber-600" />
          </div>
          <h1 className="text-3xl font-bold text-[#4255FF]">
            Session complete
          </h1>
          <p className="text-gray-500 mt-1">
            {summary.mode === "FLASHCARD" ? "Flashcards" : "Learn"} · {" "}
            {formatDuration(summary.durationSeconds)}
          </p>
        </div>

        {/* Headline accuracy card */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-3 items-center">
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600">
                  {summary.correctAnswers}
                </div>
                <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">
                  Correct
                </div>
              </div>
              <div className="text-center border-x border-gray-100">
                <div className="text-4xl font-extrabold text-gray-900">
                  {accuracyPct}
                  <span className="text-xl text-gray-400">%</span>
                </div>
                <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">
                  Accuracy
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-rose-600">
                  {summary.incorrectAnswers}
                </div>
                <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">
                  Incorrect
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detail grid */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-gray-700">
              This session
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Stat
              icon={<Target size={14} className="text-gray-500" />}
              label="Cards studied"
              value={summary.cardsStudied.toString()}
            />
            <Stat
              icon={<Clock size={14} className="text-gray-500" />}
              label="Duration"
              value={formatDuration(summary.durationSeconds)}
            />
            <Stat
              icon={
                <Sparkles size={14} className="text-amber-500" />
              }
              label="Newly mastered"
              value={newlyMastered.toString()}
              accent={newlyMastered > 0 ? "positive" : undefined}
            />
            <Stat
              icon={
                <Lightbulb size={14} className="text-gray-500" />
              }
              label="Hint used"
              value={`${hintUsedCount} ${hintUsedCount === 1 ? "card" : "cards"}`}
            />
          </CardContent>
        </Card>

        {/* SRS graduation callout — only render when the session actually
            graduated cards. Each graduation writes an SrsCard row that
            surfaces on `/srs` the next day. */}
        {newlyMastered > 0 && (
          <Card className="border-emerald-200 bg-emerald-50/60">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3 text-sm">
                <Sparkles size={18} className="text-emerald-600" />
                <span className="text-gray-800">
                  <span className="font-semibold">{newlyMastered}</span> card
                  {newlyMastered === 1 ? "" : "s"} graduated to Spaced Review.
                </span>
              </div>
              <Link
                href="/srs"
                className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
              >
                See queue →
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Overall mastery — only render if we have the rollup */}
        {latestProgress && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-gray-700">
                Overall mastery
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <MasteryBar
                mastered={latestProgress.masteredCount}
                total={latestProgress.totalCards}
              />
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button
            onClick={() => router.push(`/modules/${moduleId}/${modeRoute}`)}
            className="flex-1 sm:flex-none"
          >
            <RotateCcw size={16} className="mr-1" />
            Study again
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/modules/${moduleId}`)}
            className="flex-1 sm:flex-none"
          >
            <ArrowLeft size={16} className="mr-1" />
            Back to module
          </Button>
          <Link
            href={`/modules/${moduleId}/sessions`}
            className="text-sm text-gray-500 hover:text-[#4255FF] inline-flex items-center gap-1 ml-auto"
          >
            <History size={14} /> Session history
          </Link>
        </div>
      </div>
    </main>
  );
}

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: "positive";
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="flex items-center gap-2 text-gray-500">
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={
          accent === "positive"
            ? "font-semibold text-amber-600 inline-flex items-center gap-1"
            : "font-semibold text-gray-800"
        }
      >
        {accent === "positive" && <CheckCircle2 size={14} />}
        {value}
      </div>
    </div>
  );
}

function MasteryBar({ mastered, total }: { mastered: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((mastered / total) * 100);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          {mastered} of {total} mastered
        </span>
        <span className="font-semibold text-gray-800">{pct}%</span>
      </div>
      <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// A subtle marker export for pages that want to render an in-flight
// "wrapping up" loader while `finish()` resolves.
export function SessionResultsLoading() {
  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-[#4255FF]" />
        <p className="text-sm text-gray-500">Wrapping up your session…</p>
      </div>
    </main>
  );
}

/**
 * Small "we couldn't save the summary" fallback for the case where
 * finish() throws. Gives the learner a retry path so they don't lose
 * the sense of closure.
 */
export function SessionResultsError({
  error,
  onRetry,
  moduleId,
}: {
  error: string;
  onRetry: () => void;
  moduleId: string;
}) {
  const router = useRouter();
  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle className="text-rose-700 flex items-center gap-2">
            <XCircle size={20} /> Couldn&apos;t save your session
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">{error}</p>
          <p className="text-xs text-gray-500">
            Your answers were already recorded card-by-card — this was just
            the summary write. It&apos;s safe to retry.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={onRetry}>Try again</Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/modules/${moduleId}`)}
            >
              Back to module
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
