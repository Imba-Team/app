import { Link, useSearchParams } from 'react-router-dom';

import { LoginForm } from '@/features/auth/login-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function LoginRoute() {
  const [params] = useSearchParams();
  const justRegistered = params.get('justRegistered') === '1';

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to continue to Mimir.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {justRegistered && (
            <Alert>
              <AlertTitle>Check your inbox</AlertTitle>
              <AlertDescription>
                We sent a verification link to your email. Click it, then sign in below.
              </AlertDescription>
            </Alert>
          )}
          <LoginForm />
          <p className="text-center text-sm text-muted-foreground">
            No account yet?{' '}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Create one
            </Link>
          </p>
          <p className="text-center text-sm text-muted-foreground">
            <Link to="/forgot-password" className="hover:underline">
              Forgot password?
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
