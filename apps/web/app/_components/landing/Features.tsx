import {
  BookOpen,
  Users,
  FolderTree,
  LineChart,
  Layers,
  Target,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

const FEATURES = [
  {
    icon: Layers,
    title: 'Multiple study modes',
    body: 'Flashcards, Learn, Test and Match — pick the mode that fits how you learn today.',
  },
  {
    icon: BookOpen,
    title: 'Rich content sets',
    body: 'Create sets with images, language pairs and bulk import. Public, unlisted or private.',
  },
  {
    icon: Users,
    title: 'Collaborate & share',
    body: 'Invite editors and viewers, and leave threaded comments on any set.',
  },
  {
    icon: FolderTree,
    title: 'Folders, tags & favorites',
    body: 'Organize your library the way you think — with folders, tags and starred cards.',
  },
  {
    icon: LineChart,
    title: 'Forecast & analytics',
    body: 'See per-set mastery, average ease factor and a 30-day forecast of what is coming due.',
  },
  {
    icon: Target,
    title: 'Mastery engine',
    body: 'A New → Learning → Mastered state machine layered on top of SRS, so you can trust the signal.',
  },
];

export default function Features() {
  return (
    <section id="features" className="flex flex-col gap-8">
      <div className="max-w-2xl">
        <h2 className="text-3xl font-bold text-neutral-900 sm:text-4xl">
          Everything you need to learn
        </h2>
        <p className="mt-3 text-neutral-600">
          A focused set of features built around one goal: helping you remember what you study.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <CardContent className="flex flex-col gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-brand-500/10 text-brand-500">
                <Icon className="h-4 w-4" />
              </span>
              <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
              <p className="text-sm text-neutral-600">{body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
