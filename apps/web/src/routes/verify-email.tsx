import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useResendVerification, useVerifyEmail } from '@/lib/api/hooks/use-auth';

export function VerifyEmailRoute() {
  const { t } = useTranslation('auth');
  const [params] = useSearchParams();
  const token = params.get('token');
  const verify = useVerifyEmail();
  const resend = useResendVerification();
  const [resendEmail, setResendEmail] = useState('');
  const attempted = useRef(false);

  useEffect(() => {
    if (token && !attempted.current) {
      attempted.current = true;
      verify.mutate({ token });
    }
  }, [token, verify]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{t('verify.title')}</CardTitle>
          <CardDescription>{t('verify.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token && (
            <Alert variant="destructive">
              <AlertTitle>{t('verify.missingTokenTitle')}</AlertTitle>
              <AlertDescription>{t('verify.missingTokenDescription')}</AlertDescription>
            </Alert>
          )}

          {token && verify.isPending && (
            <p className="text-sm text-muted-foreground">{t('verify.verifying')}</p>
          )}

          {token && verify.isSuccess && (
            <Alert>
              <AlertTitle>{t('verify.successTitle')}</AlertTitle>
              <AlertDescription>
                <Trans
                  ns="auth"
                  i18nKey="verify.successDescription"
                  components={{ signInLink: <Link to="/login" className="underline" /> }}
                />
              </AlertDescription>
            </Alert>
          )}

          {token && verify.isError && (
            <Alert variant="destructive">
              <AlertTitle>{t('verify.failedTitle')}</AlertTitle>
              <AlertDescription>
                {(verify.error as { response?: { data?: { message?: string } } }).response?.data
                  ?.message ?? t('verify.failedDescription')}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="resend-email">{t('verify.resendLabel')}</Label>
            <div className="flex gap-2">
              <Input
                id="resend-email"
                type="email"
                placeholder={t('placeholders.email')}
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
              />
              <Button
                onClick={() => resend.mutate({ email: resendEmail })}
                disabled={resend.isPending || !resendEmail}
              >
                {resend.isPending ? t('actions.sending') : t('actions.resend')}
              </Button>
            </div>
            {resend.isSuccess && (
              <p className="text-xs text-muted-foreground">{t('verify.resendHint')}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
