import { Link } from 'react-router-dom';

import { RegisterForm } from '@/features/auth/register-form';
import { OAuthButtons } from '@/features/auth/oauth-buttons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export function RegisterRoute() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <CardDescription>Sign up in seconds — no credit card.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RegisterForm />
          <div className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="text-xs uppercase text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>
          <OAuthButtons />
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
