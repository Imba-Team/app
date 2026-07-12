import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/api/hooks/auth-context';
import { useResendVerification } from '@/lib/api/hooks/use-auth';

/**
 * Blocks routes that require a verified email — study modes primarily
 * (FR-AUTH-004). Wraps `RequireAuth`, so it assumes the user is already
 * signed in. If the account is unverified, shows a full-page prompt with
 * a resend button instead of the guarded content.
 */
export function RequireVerified({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const location = useLocation();
  const resend = useResendVerification();

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (currentUser.emailVerified) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto max-w-xl p-6">
      <Alert>
        <AlertTitle>Verify your email to continue</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            We sent a link to <span className="font-medium">{currentUser.email}</span>. Click it to
            unlock study modes and everything else on your account.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => resend.mutate({ email: currentUser.email })}
              disabled={resend.isPending || resend.isSuccess}
            >
              {resend.isSuccess
                ? 'Sent — check your inbox'
                : resend.isPending
                  ? 'Sending…'
                  : 'Resend verification email'}
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link to="/">Back to dashboard</Link>
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
