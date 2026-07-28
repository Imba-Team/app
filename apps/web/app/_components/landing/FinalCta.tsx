'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

export default function FinalCta() {
  const { isAuthenticated, isLoading } = useAuth();
  const href = isLoading ? '#' : isAuthenticated ? '/dashboard' : '/register';
  const label = isLoading
    ? 'Loading…'
    : isAuthenticated
      ? 'Continue to dashboard'
      : 'Get started free';

  return (
    <section>
      <Card className="bg-linear-to-br from-brand-300 to-brand-600 text-neutral-900">
        <CardContent className="flex flex-col items-center gap-5 px-6 py-12 text-center sm:py-16">
          <h2 className="text-3xl font-bold sm:text-4xl text-white/90">
            Start remembering what you study
          </h2>
          <p className="max-w-xl text-white/75">
            Join Mimir and let spaced repetition do the heavy lifting. It only takes a minute to
            create your first set.
          </p>
          <Button asChild size="lg" variant="secondary" className="bg-white/80">
            <Link href={href}>
              {label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
