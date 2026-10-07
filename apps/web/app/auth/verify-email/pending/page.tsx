'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail } from 'lucide-react';

import { useResendVerification } from '@/lib/hooks/useAuth';
import { Button } from '@/components/ui/button';

function formatSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

export default function VerifyEmailPendingPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';

  const resendMutation = useResendVerification();

  const [resendSent, setResendSent] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (cooldownUntil === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const secondsLeft =
    cooldownUntil !== null ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000)) : 0;
  const isCooling = cooldownUntil !== null && secondsLeft > 0;

  const handleResend = () => {
    if (!email || isCooling || resendMutation.isPending) return;
    resendMutation.mutate(email, {
      onSuccess: () => {
        setResendSent(true);
        setCooldownUntil(Date.now() + 60_000);
        setNow(Date.now());
      },
    });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="w-full max-w-md text-center">
        <Link
          href="/"
          className="mb-8 inline-flex items-center rounded-full px-4 py-2 text-lg font-bold text-neutral-900 transition-colors hover:bg-neutral-100"
        >
          Mimir
        </Link>

        <Mail className="mx-auto h-12 w-12 text-brand-400" />
        <h1 className="mt-4 text-2xl font-bold text-neutral-900">Check your inbox</h1>
        <p className="mt-2 text-gray-500">
          We sent a verification link to{' '}
          <span className="font-semibold text-neutral-800">{email || 'your email'}</span>.
          <br />
          Click the link to activate your account.
        </p>

        {resendSent && (
          <p role="status" className="mt-4 text-sm font-medium text-green-600">
            A new link has been sent.
          </p>
        )}

        <Button
          onClick={handleResend}
          disabled={resendMutation.isPending || isCooling || !email}
          className="mt-6 h-12 w-full rounded-xl bg-brand-500 text-base font-semibold text-white hover:bg-brand-500/90 disabled:opacity-60"
        >
          {isCooling
            ? `Resend in ${formatSeconds(secondsLeft)}`
            : resendMutation.isPending
              ? 'Sending…'
              : 'Resend verification email'}
        </Button>

        <Link
          href="/login"
          className="mt-6 inline-block text-sm text-gray-500 hover:text-brand-500"
        >
          Back to login
        </Link>
      </div>
    </main>
  );
}
