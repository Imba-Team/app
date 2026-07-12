import { Link, useSearchParams } from 'react-router-dom';

import { ResetPasswordForm } from '@/features/auth/reset-password-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ResetPasswordRoute() {
  const [params] = useSearchParams();
  const token = params.get('token');

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Set a new password</CardTitle>
          <CardDescription>Pick something strong. You'll use this to sign in.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {token ? (
            <ResetPasswordForm token={token} />
          ) : (
            <Alert variant="destructive">
              <AlertTitle>Missing token</AlertTitle>
              <AlertDescription>
                This link is missing the reset token. Request a new one from the{' '}
                <Link to="/forgot-password" className="underline">
                  forgot password
                </Link>{' '}
                page.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
