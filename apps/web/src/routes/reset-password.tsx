import { Link, useSearchParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';

import { ResetPasswordForm } from '@/features/auth/reset-password-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ResetPasswordRoute() {
  const { t } = useTranslation('auth');
  const [params] = useSearchParams();
  const token = params.get('token');

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{t('reset.title')}</CardTitle>
          <CardDescription>{t('reset.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {token ? (
            <ResetPasswordForm token={token} />
          ) : (
            <Alert variant="destructive">
              <AlertTitle>{t('reset.missingTokenTitle')}</AlertTitle>
              <AlertDescription>
                <Trans
                  ns="auth"
                  i18nKey="reset.missingTokenDescription"
                  components={{ forgotLink: <Link to="/forgot-password" className="underline" /> }}
                />
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
