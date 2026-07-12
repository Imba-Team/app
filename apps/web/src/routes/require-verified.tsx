import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('auth');
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
        <AlertTitle>{t('requireVerified.title')}</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{t('requireVerified.description', { email: currentUser.email })}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => resend.mutate({ email: currentUser.email })}
              disabled={resend.isPending || resend.isSuccess}
            >
              {resend.isSuccess
                ? t('requireVerified.resendSent')
                : resend.isPending
                  ? t('requireVerified.sending')
                  : t('actions.resendVerification')}
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link to="/">{t('requireVerified.backToDashboard')}</Link>
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
