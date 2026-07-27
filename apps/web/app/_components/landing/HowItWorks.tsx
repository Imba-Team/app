import { Card, CardContent } from '@/components/ui/card';

const STEPS = [
  {
    n: '1',
    title: 'Create or discover a set',
    body: 'Build your own study sets in seconds, or browse public sets shared by the community.',
  },
  {
    n: '2',
    title: 'Study with spaced repetition',
    body: 'Mimir schedules each card so you review it right before you would have forgotten it.',
  },
  {
    n: '3',
    title: 'Track mastery & forecast',
    body: 'See what you have mastered, what needs work, and how many cards are due each day.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="flex flex-col gap-8">
      <div className="max-w-2xl">
        <h2 className="text-3xl font-bold text-neutral-900 sm:text-4xl">How it works</h2>
        <p className="mt-3 text-neutral-600">
          Three steps to steady, lasting learning — no gimmicks, no streak guilt.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {STEPS.map((s) => (
          <Card key={s.n}>
            <CardContent className="flex flex-col gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-brand-500/10 text-sm font-bold text-brand-500">
                {s.n}
              </span>
              <h3 className="text-lg font-semibold text-neutral-900">{s.title}</h3>
              <p className="text-sm text-neutral-600">{s.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
