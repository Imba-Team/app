'use client';

/**
 * "Connected accounts" section on the account page.
 *
 * For each identity provider (currently just Google), shows whether
 * the account is linked and lets the user connect or disconnect.
 *
 * Connect flow: full-navigation to /auth/google/link (backend sets a
 * short-lived link-intent cookie and redirects to Google consent).
 * On return, backend redirects to /account?linked=1 (or ?linked=0 with
 * a reason code on conflict) — we translate that into a toast.
 *
 * Disconnect flow: DELETE /auth/google/link, confirm first because it
 * removes a sign-in path. We do NOT block on "user has no password"
 * because the forgot-password flow can always reissue one; we surface
 * that fact in the confirm dialog instead.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Link2, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiBaseUrl } from '@/lib/env';
import { useMe, useUnlinkGoogle } from '@/lib/hooks/useUser';

const LinkErrorCopy: Record<string, string> = {
  GOOGLE_LINK_TAKEN:
    'That Google account is already linked to a different user. Sign in to that account instead, or try a different Google account.',
  GOOGLE_ALREADY_LINKED:
    'Your account is already linked to a different Google account. Disconnect it first, then try again.',
  LINK_FAILED: "We couldn't connect your Google account. Please try again.",
};

export default function ConnectedAccountsCard() {
  const { data: me } = useMe();
  const unlink = useUnlinkGoogle();
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkedParam = searchParams.get('linked');
  const reasonParam = searchParams.get('reason');
  const handledResult = useRef<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Translate ?linked=1|0 (set by the backend callback) into a toast,
  // then strip the query params so a page refresh doesn't re-toast.
  useEffect(() => {
    if (!linkedParam) return;
    const key = `${linkedParam}:${reasonParam ?? ''}`;
    if (handledResult.current === key) return;
    handledResult.current = key;

    if (linkedParam === '1') {
      toast.success('Google account connected');
    } else {
      const msg = LinkErrorCopy[reasonParam ?? ''] ?? LinkErrorCopy.LINK_FAILED;
      toast.error(msg);
    }

    router.replace('/account');
  }, [linkedParam, reasonParam, router]);

  const isLinked = me?.googleLinked ?? false;

  const handleConnect = () => {
    window.location.href = `${apiBaseUrl}/auth/google/link`;
  };

  const handleDisconnect = () => {
    setConfirming(false);
    unlink.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Connected accounts</CardTitle>
        <p className="text-sm text-gray-500 mt-1">
          Sign in faster by linking a third-party identity to your account.
        </p>
      </CardHeader>

      <CardContent>
        <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 shrink-0 rounded-md bg-white border border-gray-200 p-2">
              <GoogleGlyph className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-800">Google</p>
                {isLinked ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
                    Not connected
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {isLinked
                  ? 'You can sign in with either your password or Google.'
                  : 'Connect Google to enable one-click sign-in.'}
              </p>
            </div>
          </div>

          {isLinked ? (
            confirming ? (
              <div className="flex flex-col items-end gap-2 shrink-0">
                <p className="text-xs text-gray-600 max-w-55 text-right">
                  You&apos;ll need your password to sign in. If you don&apos;t remember it, use
                  &quot;Forgot password&quot; to set a new one.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirming(false)}
                    disabled={unlink.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={unlink.isPending}
                    className="bg-rose-600 hover:bg-rose-700 text-white"
                  >
                    {unlink.isPending ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Disconnecting…
                      </>
                    ) : (
                      <>
                        <Unlink className="h-3 w-3" />
                        Confirm
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirming(true)}
                className="shrink-0"
              >
                <Unlink className="h-3 w-3" />
                Disconnect
              </Button>
            )
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleConnect}
              className="shrink-0"
            >
              <Link2 className="h-3 w-3" />
              Connect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44a5.51 5.51 0 0 1-2.39 3.62v3h3.86c2.26-2.09 3.58-5.17 3.58-8.86z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.94-2.91l-3.86-3c-1.07.72-2.44 1.16-4.08 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.997 11.997 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.19 7.19 0 0 1 4.89 12c0-.79.14-1.56.38-2.29V6.62H1.29A11.997 11.997 0 0 0 0 12c0 1.94.46 3.78 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}
