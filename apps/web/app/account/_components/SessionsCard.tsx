"use client";

/**
 * Lists the user's active sessions (one per refresh-token family) and
 * lets them revoke any device — including the current one, which
 * doubles as a "sign out everywhere else, then here" gesture.
 *
 * Revoking the current session clears cookies server-side; we then
 * push to /login and let AuthContext catch up on next mount.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Monitor, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useSessions, useRevokeSession } from "@/lib/hooks/useSessions";
import { parseUserAgent } from "@/lib/uaParse";
import type { SessionSummary } from "@/lib/api/sessions";

export default function SessionsCard() {
  const { data: sessions, isLoading, isError, refetch } = useSessions();
  const { checkAuthentication } = useAuth();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const revoke = useRevokeSession({
    onSuccess: async (result) => {
      setPendingId(null);
      if (result.wasCurrent) {
        toast.success("Signed out on this device.");
        await checkAuthentication();
        router.push("/login");
      } else {
        toast.success("Session revoked.");
      }
    },
  });

  const handleRevoke = (session: SessionSummary) => {
    const confirmMsg = session.isCurrent
      ? "Revoke this session? You'll be signed out of this device immediately."
      : "Revoke this session? The device will need to sign in again.";
    if (!window.confirm(confirmMsg)) return;
    setPendingId(session.id);
    revoke.mutate(session.id);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Active sessions</CardTitle>
        <p className="text-sm text-gray-500 mt-1">
          Devices that are currently signed in to your account. Revoke any
          session you don&apos;t recognise.
        </p>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-lg bg-gray-200" />
            <Skeleton className="h-16 w-full rounded-lg bg-gray-200" />
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">Couldn&apos;t load your sessions.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => void refetch()}
              >
                Try again
              </Button>
            </div>
          </div>
        ) : !sessions || sessions.length === 0 ? (
          <p className="text-sm text-gray-500">No active sessions found.</p>
        ) : (
          <ul className="space-y-3">
            {sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                pending={pendingId === session.id && revoke.isPending}
                onRevoke={() => handleRevoke(session)}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SessionRow({
  session,
  pending,
  onRevoke,
}: {
  session: SessionSummary;
  pending: boolean;
  onRevoke: () => void;
}) {
  const { label } = parseUserAgent(session.userAgent);
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 p-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 shrink-0 rounded-md bg-gray-100 p-2 text-gray-600">
          <Monitor className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-800 truncate">
              {label}
            </p>
            {session.isCurrent && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <ShieldCheck className="h-3 w-3" />
                This device
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {session.ipAddress ?? "Unknown IP"} · Last active{" "}
            {formatRelative(session.lastUsedAt)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Signed in {formatAbsolute(session.createdAt)}
          </p>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRevoke}
        disabled={pending}
        className="shrink-0"
      >
        {pending ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Revoking…
          </>
        ) : session.isCurrent ? (
          "Sign out"
        ) : (
          "Revoke"
        )}
      </Button>
    </li>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
