import { useEffect, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/lib/api/hooks/auth-context';
import type { components } from '@/lib/api/generated/api-types';

type User = components['schemas']['UserResponseDto'];

/**
 * Landing page after a successful OAuth handshake. The backend has already
 * set the session cookies; here we fetch /users/me, hydrate the auth
 * context, and hand off to the dashboard. On failure we bounce to /login.
 */
export function OAuthCallbackRoute() {
  const { t } = useTranslation('auth');
  const { provider } = useParams<{ provider: string }>();
  const [params] = useSearchParams();
  const ok = params.get('ok') === '1';
  const { client, setCurrentUser } = useAuth();
  const [state, setState] = useState<'loading' | 'done' | 'error'>(
    ok ? 'loading' : 'error',
  );

  useEffect(() => {
    if (!ok) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await client.get<User>('/users/me');
        if (cancelled) return;
        setCurrentUser(data);
        setState('done');
      } catch {
        if (cancelled) return;
        setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ok, client, setCurrentUser]);

  if (state === 'done') return <Navigate to="/" replace />;
  if (state === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>{t('oauth.failedTitle')}</AlertTitle>
          <AlertDescription>
            {t('oauth.failedDescription', { provider: provider ?? 'OAuth' })}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 text-sm text-muted-foreground">
      {t('oauth.signingIn')}
    </div>
  );
}
