import { PrimaryCta } from './primaryCta';
import { Section } from './section';

export function Hero() {
  return (
    <Section
      id="about"
      reveal={false}
      className="flex min-h-[70vh] flex-col items-center justify-center gap-8 py-16 text-center sm:py-20"
    >
      <h1 className="font-sans text-5xl font-bold leading-[1.05] tracking-tight text-neutral-900 sm:text-6xl lg:text-7xl">
        Study less.
        <br />
        <span className="animate-highlight box-decoration-clone bg-linear-to-t from-brand-300 from-35% to-transparent to-35% bg-left bg-no-repeat px-2">
          Remember more.
        </span>
      </h1>

      <p className="max-w-xl text-lg leading-relaxed text-neutral-600">
        Mimir brings each card back right before you&apos;d forget it, so every minute you spend
        reviewing actually sticks.
      </p>

      <div className="flex flex-col items-center gap-4">
        <PrimaryCta showLogin />
        <p className="text-sm text-neutral-600">Free to use · No credit card needed</p>
      </div>
    </Section>
  );
}
