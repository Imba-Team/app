'use client';

/**
 * Account settings page.
 *
 * Layout mirrors the module / sessions pages: top back-link, a plain
 * header, and stacked cards with the same visual language (white
 * background, subtle border, standard CardHeader/Content). No more
 * gradient headers or negative-margin hacks.
 *
 * Sections:
 *   1. ProfileCard   — avatar + display name + bio (inline edit),
 *                       read-only email + verified badge + member-since.
 *   2. PreferencesCard — placeholder for language / timezone (Sprint 1b).
 *   3. SecurityCard  — change password + sign out.
 *   4. DangerZone    — delete account (was orphaned before).
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/lib/hooks/useUser';
import ProfileCard from './_components/ProfileCard';
import SecurityCard from './_components/SecurityCard';
import SessionsCard from './_components/SessionsCard';
import ConnectedAccountsCard from './_components/ConnectedAccountsCard';
import PreferencesCard from './_components/PreferencesCard';
import DangerZone from './_components/DangerZone';

export default function AccountPage() {
  const router = useRouter();
  const { data: me, isLoading, isError } = useMe();

  useEffect(() => {
    // The /users/me endpoint returns 401 when unauthenticated; the
    // axios refresh-on-401 interceptor tries once, and if that also
    // fails the query lands in `error`. Bounce to login.
    if (isError) {
      router.push('/login');
    }
  }, [isError, router]);

  return (
    <main className="min-h-screen py-8 px-4 pb-16">
      <div className="mx-auto w-full max-w-3xl">
        {/* Top nav */}
        <div className="mb-6">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" /> Back to dashboard
            </Link>
          </Button>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-700">Account</h1>
          <p className="text-gray-500 mt-1">Manage your profile, security, and preferences.</p>
        </div>

        {/* Sections */}
        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-52 w-full rounded-lg bg-gray-200" />
            <Skeleton className="h-32 w-full rounded-lg bg-gray-200" />
            <Skeleton className="h-80 w-full rounded-lg bg-gray-200" />
          </div>
        ) : me ? (
          <div className="space-y-6">
            <ProfileCard user={me} />
            <PreferencesCard />
            <SecurityCard />
            <ConnectedAccountsCard />
            <SessionsCard />
            <DangerZone />
          </div>
        ) : null}
      </div>
    </main>
  );
}
