import { CalendarDays, FolderTree, Layers, Lock, Target, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { Section, SectionHeading } from './section';

// Bento order: two wide tiles per three rows, so the grid closes evenly
// (2+1 / 1+2 / 1+2 on md+).
const features = [
  {
    icon: Layers,
    title: 'Study modes',
    body: 'Flashcards, Learn, Write and Test, with a matching warm-up in Learn. Pick what fits how you want to study today.',
    isWide: true,
  },
  {
    icon: Target,
    title: 'Mastery you can trust',
    body: "A card counts as mastered only when you've proven it — not when you've just seen it.",
  },
  {
    icon: CalendarDays,
    title: 'Plan your week',
    body: 'See how many cards are due today, tomorrow and over the next 30 days.',
  },
  {
    icon: FolderTree,
    title: 'Your library, your way',
    body: 'Folders, tags and starred cards, plus bulk import with images and language pairs.',
    isWide: true,
  },
  {
    icon: Users,
    title: 'Study together',
    body: 'Invite classmates to your sets and leave comments for each other.',
    badge: 'Coming soon',
  },
  {
    icon: Lock,
    title: 'Private by default',
    body: 'Every set is Private, Unlisted or Public. You decide who sees what you study.',
    isWide: true,
  },
];

export function Features() {
  return (
    <Section id="features" tone="raised">
      <SectionHeading eyebrow="Features" title="Everything you need to actually remember" />

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {features.map(({ icon: Icon, title, body, badge, isWide }) => (
          <article
            key={title}
            className={cn(
              'flex flex-col gap-4 rounded-3xl border border-black/5 bg-white p-6 sm:p-8',
              isWide && 'md:col-span-2',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
                <Icon className="size-5" />
              </span>
              {badge && (
                <Badge variant="outline" className="text-neutral-600">
                  {badge}
                </Badge>
              )}
            </div>
            <div>
              <h3 className="font-sans text-lg font-semibold text-neutral-900 sm:text-xl">
                {title}
              </h3>
              <p className="mt-2 max-w-md leading-relaxed text-neutral-600">{body}</p>
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}
