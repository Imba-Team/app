import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { RegisterForm } from '@/features/auth/register-form';
import { OAuthButtons } from '@/features/auth/oauth-buttons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export function RegisterRoute() {
  const { t } = useTranslation('auth');
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{t('register.title')}</CardTitle>
          <CardDescription>{t('register.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RegisterForm />
          <div className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="text-xs uppercase text-muted-foreground">{t('or')}</span>
            <Separator className="flex-1" />
          </div>
          <OAuthButtons />
          <p className="text-center text-sm text-muted-foreground">
            {t('register.alreadyHaveAccount')}{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              {t('register.signIn')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
