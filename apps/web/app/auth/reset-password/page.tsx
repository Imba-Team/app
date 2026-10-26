'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CheckCircle2, XCircle } from 'lucide-react';

import { AuthApiError } from '@/lib/api/auth';
import { useResetPassword } from '@/lib/hooks/useAuth';
import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const resetSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type ResetFormValues = z.infer<typeof resetSchema>;

// The emailed link is /auth/reset-password?token=… (see the server's
// MagicLinkService). useSearchParams needs a Suspense boundary.
export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="w-full max-w-md">
        <div className="text-center">
          <Link
            href="/"
            className="mb-8 inline-flex items-center rounded-full px-4 py-2 text-lg font-bold text-neutral-900 transition-colors hover:bg-neutral-100"
          >
            Mimir
          </Link>
        </div>
        <Suspense>
          <ResetPasswordContent />
        </Suspense>
      </div>
    </main>
  );
}

function ResetPasswordContent() {
  const token = useSearchParams().get('token');
  const resetPassword = useResetPassword();
  const [status, setStatus] = useState<'form' | 'success' | 'invalid'>(
    token ? 'form' : 'invalid',
  );
  const [error, setError] = useState('');

  const form = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const handleSubmit = form.handleSubmit((values) => {
    if (!token) return;
    setError('');
    resetPassword.mutate(
      { token, ...values },
      {
        onSuccess: () => setStatus('success'),
        onError: (err) => {
          // INVALID_TOKEN = expired or already used; anything else
          // (validation, network, 5xx) is shown inline so the user can retry.
          if (err instanceof AuthApiError && err.code === 'INVALID_TOKEN') {
            setStatus('invalid');
          } else {
            setError(err.message);
          }
        },
      },
    );
  });

  if (status === 'success') {
    return (
      <div className="text-center" role="status">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
        <h1 className="mt-4 text-2xl font-bold text-neutral-900">Password updated</h1>
        <p className="mt-2 text-gray-500">
          For your security, you&apos;ve been signed out on every device. Log in with your new
          password.
        </p>
        <Button asChild className="mt-6 h-12 w-full rounded-xl text-base font-semibold">
          <Link href="/login">Go to login</Link>
        </Button>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="text-center">
        <XCircle className="mx-auto h-12 w-12 text-rose-500" />
        <h1 className="mt-4 text-2xl font-bold text-neutral-900">Link invalid or expired</h1>
        <p className="mt-2 text-gray-500">
          Reset links work once and expire after 15 minutes. Request a new one to continue.
        </p>
        <Button asChild className="mt-6 h-12 w-full rounded-xl text-base font-semibold">
          <Link href="/auth/forgot-password">Request a new link</Link>
        </Button>
        <Link
          href="/login"
          className="mt-4 inline-block text-sm text-gray-500 hover:text-neutral-900"
        >
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-center text-2xl font-bold text-neutral-900">Set a new password</h1>
      <p className="mt-2 text-center text-gray-500">Choose a password of at least 8 characters.</p>

      <Form {...form}>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm text-neutral-700">New password</FormLabel>
                <FormControl>
                  <PasswordInput {...field} autoComplete="new-password" placeholder="New password" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm text-neutral-700">Confirm new password</FormLabel>
                <FormControl>
                  <PasswordInput
                    {...field}
                    autoComplete="new-password"
                    placeholder="Repeat new password"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {error && (
            <p role="alert" className="text-sm text-rose-600">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={resetPassword.isPending}
            className="h-12 w-full rounded-xl text-base font-semibold disabled:opacity-60"
          >
            {resetPassword.isPending ? 'Saving…' : 'Set new password'}
          </Button>
        </form>
      </Form>
    </>
  );
}
