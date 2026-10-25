import { CalendarClock, RotateCcw, TrendingDown } from 'lucide-react';

import { ForgettingCurve } from './forgettingCurve';
import { Section, SectionHeading } from './section';

const points = [
  {
    icon: TrendingDown,
    title: 'Forgetting is predictable',
    body: 'Without review, you lose most of what you learn within a few days.',
  },
  {
    icon: RotateCcw,
    title: 'Reviews reset the curve',
    body: 'Each well-timed review brings it back, and makes the memory last longer than before.',
  },
  {
    icon: CalendarClock,
    title: 'Mimir does the timing',
    body: 'It schedules every card for you using SM-2, so you only review what is about to slip.',
  },
];

export function WhyItWorks() {
  return (
    <Section id="why-it-works" tone="raised">
      <div className="grid items-center gap-12 md:grid-cols-[5fr_7fr] md:gap-12 lg:gap-16">
        <div className="flex flex-col gap-10">
          <SectionHeading
            eyebrow="The science"
            title="Your brain forgets on a schedule. Mimir reviews on one too."
          />
          <ul className="flex flex-col gap-6">
            {points.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
                  <Icon className="size-5" />
                </span>
                <div>
                  <h3 className="font-sans font-semibold text-neutral-900">{title}</h3>
                  <p className="mt-1 leading-relaxed text-neutral-600">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <ForgettingCurve />
      </div>
    </Section>
  );
}
