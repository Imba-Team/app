import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { ForgotPasswordForm } from '@/features/auth/forgot-password-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ForgotPasswordRoute() {
  const { t } = useTranslation('auth');
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{t('forgot.title')}</CardTitle>
          <CardDescription>{t('forgot.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ForgotPasswordForm />
          <p className="text-center text-sm text-muted-foreground">
            {t('forgot.back')}{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              {t('forgot.backLink')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
