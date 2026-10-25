import { cn } from '@/lib/utils';

import { Reveal } from './reveal';

type SectionTone = 'plain' | 'raised' | 'dark';

const toneClass: Record<SectionTone, string> = {
  plain: '',
  raised: 'border-y border-black/5 bg-white/70',
  dark: 'bg-neutral-900 text-white',
};

// Full-bleed band with the shared landing container, so section backgrounds
// can alternate while content stays aligned. Content reveals on scroll unless
// `reveal` is off (the hero, which is visible on load).
export function Section({
  id,
  tone = 'plain',
  reveal = true,
  className,
  children,
}: {
  id?: string;
  tone?: SectionTone;
  reveal?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const containerClass = cn('mx-auto max-w-6xl px-6 py-20 sm:px-8 sm:py-28', className);

  return (
    <section id={id} className={toneClass[tone]}>
      {reveal ? (
        <Reveal className={containerClass}>{children}</Reveal>
      ) : (
        <div className={containerClass}>{children}</div>
      )}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex max-w-2xl flex-col gap-3',
        align === 'center' && 'mx-auto items-center text-center',
        className,
      )}
    >
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">{eyebrow}</p>
      )}
      <h2 className="font-sans text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="text-lg leading-relaxed text-neutral-600">{description}</p>
      )}
    </div>
  );
}
