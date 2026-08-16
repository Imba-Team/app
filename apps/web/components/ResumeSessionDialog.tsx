'use client';

/**
 * Blocking dialog shown on the Learn entry when the caller has an
 * in-flight (ACTIVE or PAUSED) session for this set. The learner picks
 * either "Resume" — hydrate from the server-saved snapshot — or
 * "Start fresh" — abandon the old session and start a new one.
 *
 * The parent (LearnModeClient) gates its `enabled` flag on this choice
 * so `useLearnSession` doesn't start a new session prematurely.
 */

import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { InflightSession } from '@/lib/api';

export function ResumeSessionDialog({
  open,
  session,
  busy,
  onResume,
  onStartFresh,
}: {
  open: boolean;
  session: InflightSession;
  busy: boolean;
  onResume: () => void;
  onStartFresh: () => void;
}) {
  const paused = session.status === 'PAUSED';
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Pick up where you left off?</DialogTitle>
          <DialogDescription>
            You have {paused ? 'a paused' : 'an in-flight'} Learn session on this
            set with {session.cardsStudied}{' '}
            {session.cardsStudied === 1 ? 'card' : 'cards'} answered.{' '}
            {formatRelative(session.lastActivityAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-black/10 bg-neutral-50 p-3 text-sm text-neutral-700">
          Resuming keeps your streaks and comes back to the same cards. Starting
          fresh abandons this session — your mastery is preserved either way.
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onStartFresh} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Start fresh'}
          </Button>
          <Button onClick={onResume} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Resume'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'Last active just now.';
  if (mins < 60) return `Last active ${mins} minute${mins === 1 ? '' : 's'} ago.`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Last active ${hours} hour${hours === 1 ? '' : 's'} ago.`;
  const days = Math.round(hours / 24);
  return `Last active ${days} day${days === 1 ? '' : 's'} ago.`;
}
