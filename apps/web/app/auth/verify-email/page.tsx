'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

import { useVerifyEmail, useResendVerification } from '@/lib/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

type Status = 'loading' | 'success' | 'error';

const resendSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ResendFormValues = z.infer<typeof resendSchema>;

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const verifyMutation = useVerifyEmail();
  const resendMutation = useResendVerification();

  const [status, setStatus] = useState<Status>('loading');
  const [resendSent, setResendSent] = useState(false);

  const form = useForm<ResendFormValues>({
    resolver: zodResolver(resendSchema),
    defaultValues: { email: '' },
  });

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }
    verifyMutation.mutate(token, {
      onSuccess: () => setStatus('success'),
      onError: () => setStatus('error'),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResend = form.handleSubmit((values) => {
    resendMutation.mutate(values.email, {
      onSuccess: () => setResendSent(true),
    });
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="w-full max-w-md text-center">
        <Link
          href="/"
          className="mb-8 inline-flex items-center rounded-full px-4 py-2 text-lg font-bold text-neutral-900 transition-colors hover:bg-neutral-100"
        >
          Mimir
        </Link>

        {status === 'loading' && (
          <div className="mt-4">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-brand-400" />
            <p className="mt-4 text-gray-600">Verifying your email…</p>
          </div>
        )}

        {status === 'success' && (
          <div className="mt-4">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <h1 className="mt-4 text-2xl font-bold text-neutral-900">Email verified!</h1>
            <p className="mt-2 text-gray-500">You can now sign in to your account.</p>
            <Button
              asChild
              className="mt-6 h-12 w-full rounded-xl bg-brand-500 text-base font-semibold text-white hover:bg-brand-500/90"
            >
              <Link href="/login">Go to login</Link>
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-4">
            <XCircle className="mx-auto h-12 w-12 text-rose-500" />
            <h1 className="mt-4 text-2xl font-bold text-neutral-900">Link invalid or expired</h1>
            <p className="mt-2 text-gray-500">
              This verification link has expired or already been used. Enter your email to get a new
              one.
            </p>

            <div className="mt-6">
              {resendSent ? (
                <p role="status" className="text-sm font-medium text-green-600">
                  A new link has been sent — check your inbox.
                </p>
              ) : (
                <Form {...form}>
                  <form onSubmit={handleResend} className="flex flex-col gap-3 text-left">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm text-neutral-700">Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="you@example.com"
                              autoComplete="email"
                              {...field}
                              className="h-12 rounded-xl border-gray-300 focus-visible:ring-brand-400"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      disabled={resendMutation.isPending}
                      className="h-12 rounded-xl bg-brand-500 text-base font-semibold text-white hover:bg-brand-500/90 disabled:opacity-60"
                    >
                      {resendMutation.isPending ? 'Sending…' : 'Resend verification email'}
                    </Button>
                  </form>
                </Form>
              )}
            </div>

            <Link
              href="/login"
              className="mt-4 inline-block text-sm text-gray-500 hover:text-brand-500"
            >
              Back to login
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
