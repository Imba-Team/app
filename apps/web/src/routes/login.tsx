import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { LoginForm } from '@/features/auth/login-form';
import { OAuthButtons } from '@/features/auth/oauth-buttons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export function LoginRoute() {
  const { t } = useTranslation('auth');
  const [params] = useSearchParams();
  const justRegistered = params.get('justRegistered') === '1';

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{t('login.title')}</CardTitle>
          <CardDescription>{t('login.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {justRegistered && (
            <Alert>
              <AlertTitle>{t('login.justRegisteredTitle')}</AlertTitle>
              <AlertDescription>{t('login.justRegisteredDescription')}</AlertDescription>
            </Alert>
          )}
          <LoginForm />
          <div className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="text-xs uppercase text-muted-foreground">{t('or')}</span>
            <Separator className="flex-1" />
          </div>
          <OAuthButtons />
          <p className="text-center text-sm text-muted-foreground">
            {t('login.noAccount')}{' '}
            <Link to="/register" className="font-medium text-primary hover:underline">
              {t('login.createOne')}
            </Link>
          </p>
          <p className="text-center text-sm text-muted-foreground">
            <Link to="/forgot-password" className="hover:underline">
              {t('login.forgotPassword')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
