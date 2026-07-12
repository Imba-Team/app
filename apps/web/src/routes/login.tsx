import { Link, useSearchParams } from 'react-router-dom';

import { LoginForm } from '@/features/auth/login-form';
import { OAuthButtons } from '@/features/auth/oauth-buttons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

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
          <div className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="text-xs uppercase text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>
          <OAuthButtons />
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
