'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

// Defaults to the logged-out CTA so the server-rendered HTML always has a
// real link; signed-in users get swapped to the dashboard once auth resolves.
export function PrimaryCta({ showLogin = false }: { showLogin?: boolean }) {
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <Button asChild size="lg">
        <Link href={isAuthenticated ? '/dashboard' : '/register'}>
          {isAuthenticated ? 'Continue to dashboard' : 'Get started free'}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
      {showLogin && !isAuthenticated && (
        <Button asChild variant="secondary" size="lg">
          <Link href="/login">Log in</Link>
        </Button>
      )}
    </div>
  );
}
