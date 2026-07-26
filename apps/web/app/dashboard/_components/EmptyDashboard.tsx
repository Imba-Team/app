"use client";

import Link from "next/link";
import { BookOpen, Compass, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * First-run screen for a learner with zero modules.
 *
 * Replaces the standard dashboard grid until the user has at least one
 * module in their collection. Points at two paths: create your own
 * (primary CTA) or discover something in the Community tab.
 */
export default function EmptyDashboard() {
  return (
    <section className="py-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#4255FF] to-[#7B49E7] text-white p-8 sm:p-12 shadow-lg">
        <div className="absolute -top-8 -right-8 opacity-20">
          <Sparkles size={140} strokeWidth={1.4} />
        </div>
        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium mb-4">
            <Sparkles size={12} /> Welcome to Mimir
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-3">
            Your first module is a few clicks away.
          </h1>
          <p className="text-white/85 text-base sm:text-lg mb-6">
            Modules are your study sets — a topic plus the flashcards you want
            to learn. Create one, study with Flashcards, Learn, or Test, and
            Mimir tracks your mastery card-by-card.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="bg-white text-[#4255FF] hover:bg-white/90"
            >
              <Link href="/modules/new">
                <Plus size={18} className="mr-1" />
                Create your first module
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              // Not `variant="outline"` — that variant hardcodes
              // `bg-background` (white in light mode) which renders as
              // white-on-white on top of the gradient hero. Custom
              // ghost-outline styles that work on the dark backdrop.
              variant="ghost"
              className="bg-transparent! border border-white/40 text-white hover:bg-white/10! hover:text-white"
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
        <h2 className="text-2xl text-[#4255FF] font-bold mb-4">
          Recent Modules
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <Link href="/modules/new" className="block">
            <Card className="p-6 cursor-pointer h-32 flex items-center justify-center">
              <CardContent className="p-0 text-center">
                <div className="mx-auto mb-2 rounded-full bg-[#4255FF]/10 p-2 w-fit">
                  <Plus size={20} className="text-[#4255FF]" />
                </div>
                <p className="font-semibold text-gray-800">
                  Create your first module
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Ctrl+N works here too
                </p>
              </CardContent>
            </Card>
          </Link>
          <Card className="bg-gray-50 p-6 h-32 flex items-center justify-center">
            <CardContent className="p-0 text-center text-gray-400">
              <BookOpen size={20} className="mx-auto mb-1" />
              <p className="text-sm">
                Modules you study will appear here.
              </p>
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
