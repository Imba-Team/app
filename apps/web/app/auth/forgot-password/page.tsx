'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { MailCheck } from 'lucide-react';

import { useRequestPasswordReset } from '@/lib/hooks/useAuth';
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

const forgotSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotFormValues = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const requestReset = useRequestPasswordReset();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState('');

  const form = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  const handleSubmit = form.handleSubmit((values) => {
    setError('');
    requestReset.mutate(values.email, {
      onSuccess: () => setSentTo(values.email),
      onError: (err) => setError(err.message),
    });
  });

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

        {sentTo ? (
          <div className="text-center" role="status">
            <MailCheck className="mx-auto h-12 w-12 text-green-500" />
            <h1 className="mt-4 text-2xl font-bold text-neutral-900">Check your inbox</h1>
            {/* The API answers the same way whether or not the account exists,
                so the copy must not confirm that it does. */}
            <p className="mt-2 text-gray-500">
              If an account exists for <span className="font-medium">{sentTo}</span>, we&apos;ve
              sent a link to reset your password. It expires in 15 minutes.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-center text-2xl font-bold text-neutral-900">Forgot your password?</h1>
            <p className="mt-2 text-center text-gray-500">
              Enter your account email and we&apos;ll send you a link to set a new one.
            </p>

            <Form {...form}>
              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
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

                {error && (
                  <p role="alert" className="text-sm text-rose-600">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={requestReset.isPending}
                  className="h-12 w-full rounded-xl text-base font-semibold disabled:opacity-60"
                >
                  {requestReset.isPending ? 'Sending…' : 'Send reset link'}
                </Button>
              </form>
            </Form>
          </>
        )}

        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-gray-500 hover:text-neutral-900">
            Back to login
          </Link>
        </div>
      </div>
    </main>
  );
}
