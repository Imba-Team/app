import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useResendVerification, useVerifyEmail } from '@/lib/api/hooks/use-auth';

export function VerifyEmailRoute() {
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
          <CardTitle className="text-2xl">Verify your email</CardTitle>
          <CardDescription>
            Confirm your address so you can start studying.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token && (
            <Alert variant="destructive">
              <AlertTitle>Missing token</AlertTitle>
              <AlertDescription>
                Open the verification link from the email we sent you, or request a new link
                below.
              </AlertDescription>
            </Alert>
          )}

          {token && verify.isPending && (
            <p className="text-sm text-muted-foreground">Verifying…</p>
          )}

          {token && verify.isSuccess && (
            <Alert>
              <AlertTitle>Email verified</AlertTitle>
              <AlertDescription>
                You're all set. <Link to="/login" className="underline">Sign in</Link> to continue.
              </AlertDescription>
            </Alert>
          )}

          {token && verify.isError && (
            <Alert variant="destructive">
              <AlertTitle>Verification failed</AlertTitle>
              <AlertDescription>
                {(verify.error as { response?: { data?: { message?: string } } }).response?.data
                  ?.message ??
                  'The link is invalid or has expired. Request a new one below.'}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="resend-email">Resend verification email</Label>
            <div className="flex gap-2">
              <Input
                id="resend-email"
                type="email"
                placeholder="you@example.com"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
              />
              <Button
                onClick={() => resend.mutate({ email: resendEmail })}
                disabled={resend.isPending || !resendEmail}
              >
                {resend.isPending ? 'Sending…' : 'Resend'}
              </Button>
            </div>
            {resend.isSuccess && (
              <p className="text-xs text-muted-foreground">
                If an unverified account exists for that email, a new link is on its way.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
