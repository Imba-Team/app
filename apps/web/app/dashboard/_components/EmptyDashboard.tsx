'use client';

import Link from 'next/link';
import { BookOpen, Compass, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCreateModuleDialog } from '@/contexts/CreateModuleDialogContext';

/**
 * First-run screen for a learner with zero modules.
 *
 * Replaces the standard dashboard grid until the user has at least one
 * module in their collection. Points at two paths: create your own
 * (primary CTA) or discover something in the Community tab.
 */
export default function EmptyDashboard() {
  const createModule = useCreateModuleDialog();
  return (
    <section className="py-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-300 to-brand-600 text-neutral-900 p-8 sm:p-12 shadow-lg">
        <div className="absolute -top-8 -right-8 opacity-15 text-neutral-900">
          <Sparkles size={140} strokeWidth={1.4} />
        </div>
        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-neutral-900/10 px-3 py-1 text-xs font-medium mb-4">
            <Sparkles size={12} /> Welcome to Mimir
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-3">
            Your first module is a few clicks away.
          </h1>
          <p className="text-neutral-900/75 text-base sm:text-lg mb-6">
            Modules are your study sets — a topic plus the flashcards you want to learn. Create one,
            study with Flashcards, Learn, or Test, and Mimir tracks your mastery card-by-card.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              onClick={() => createModule.open()}
              className="bg-neutral-900 text-white hover:bg-neutral-800"
            >
              <Plus size={18} className="mr-1" />
              Create your first module
            </Button>
            <Button
              asChild
              size="lg"
              // Not `variant="outline"` — that variant hardcodes
              // `bg-background` (white) which fights the yellow gradient.
              // Custom ghost-outline styles keyed off the darker text tone.
              variant="ghost"
              className="bg-transparent! border border-neutral-900/40 text-neutral-900 hover:bg-neutral-900/10! hover:text-neutral-900"
            >
              <Link href="/discover">
                <Compass size={18} className="mr-1" />
                Browse Discover
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Placeholder for the Recent Modules slot — keeps the visual
          rhythm of the populated dashboard so returning users aren't
          surprised by a totally different layout. */}
      <div className="mt-10">
        <h2 className="text-2xl text-brand-500 font-bold mb-4">Recent Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => createModule.open()}
            className="block w-full text-left"
          >
            <Card className="p-6 cursor-pointer h-32 flex items-center justify-center">
              <CardContent className="p-0 text-center">
                <div className="mx-auto mb-2 rounded-full bg-brand-500/10 p-2 w-fit">
                  <Plus size={20} className="text-brand-500" />
                </div>
                <p className="font-semibold text-gray-800">Create your first module</p>
                <p className="text-xs text-gray-500 mt-0.5">Ctrl+N works here too</p>
              </CardContent>
            </Card>
          </button>
          <Card className="bg-gray-50 p-6 h-32 flex items-center justify-center">
            <CardContent className="p-0 text-center text-gray-400">
              <BookOpen size={20} className="mx-auto mb-1" />
              <p className="text-sm">Modules you study will appear here.</p>
            </CardContent>
          </Card>
          <div className="hidden md:block">
            <Card className="bg-gray-50 p-6 h-32 flex items-center justify-center">
              <CardContent className="p-0 text-center text-gray-400">
                <BookOpen size={20} className="mx-auto mb-1" />
                <p className="text-sm">Ready when you are.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
