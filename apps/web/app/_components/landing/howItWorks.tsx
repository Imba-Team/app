import { Section, SectionHeading } from './section';

const steps = [
  {
    title: 'Make or find a set',
    body: 'Create your own in seconds, or pick one from Discover.',
  },
  {
    title: 'Review a few minutes a day',
    body: 'Mimir shows you only the cards that are due.',
  },
  {
    title: 'Watch it stick',
    body: 'Cards move from New → Learning → Mastered as you prove you know them.',
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works">
      <SectionHeading eyebrow="How it works" title="Three steps. No streak guilt." align="center" />

      <div className="relative mt-14">
        {/* Connector between step numerals; the opaque circles sit on top of it. */}
        <div
          aria-hidden
          className="absolute inset-x-[16%] top-8 hidden border-t-2 border-neutral-900/10 md:block"
        />
        <ol className="relative grid gap-12 md:grid-cols-3 md:gap-8">
          {steps.map((step, i) => (
            <li key={step.title} className="flex flex-col items-center gap-4 text-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-brand-300 font-sans text-2xl font-bold text-neutral-900">
                {i + 1}
              </span>
              <h3 className="font-sans text-lg font-semibold text-neutral-900 sm:text-xl">
                {step.title}
              </h3>
              <p className="max-w-xs leading-relaxed text-neutral-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
