import { PrimaryCta } from './primaryCta';
import { Section } from './section';

export function FinalCta() {
  return (
    <Section tone="dark" className="flex flex-col items-center gap-6 text-center">
      <h2 className="font-sans text-3xl font-bold tracking-tight text-white sm:text-5xl">
        Start remembering what you study
      </h2>
      <p className="max-w-xl text-lg leading-relaxed text-neutral-300">
        Join Mimir and let spaced repetition do the heavy lifting. It only takes a minute to create
        your first set.
      </p>
      <div className="flex flex-col items-center gap-4">
        <PrimaryCta />
        <p className="text-sm text-neutral-400">Free to use · No credit card needed</p>
      </div>
    </Section>
  );
}
