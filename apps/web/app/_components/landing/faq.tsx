import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

import { Section, SectionHeading } from './section';

const faqItems: { q: string; a: React.ReactNode }[] = [
  {
    q: 'What is spaced repetition?',
    a: (
      <>
        A way of reviewing that shows you each card right before you&apos;d forget it. Cards you
        know well come back less often; cards you struggle with come back sooner. Mimir uses SM-2,
        a well-studied scheduling algorithm —{' '}
        <a href="#why-it-works" className="font-medium text-neutral-900 underline underline-offset-4">
          see how it works
        </a>
        .
      </>
    ),
  },
  {
    q: 'How is Mimir different from Quizlet or Anki?',
    a: "Mimir schedules reviews with the same proven approach as Anki, in a modern interface. It also tracks mastery across study modes, so a card only counts as mastered once you've really recalled it.",
  },
  {
    q: 'Is my data private?',
    a: 'Yes. Every set is public or private, and you choose. Your password is stored hashed, and your login session lives in secure cookies.',
  },
  {
    q: 'Can I study with classmates?',
    a: "You can already comment on the sets you study, and public sets are discoverable through Discover. Inviting classmates as editors or viewers is coming soon.",
  },
  {
    q: 'Is Mimir free?',
    a: 'The core study experience is free while we build out the platform. AI-assisted features are on our roadmap for later.',
  },
];

export function Faq() {
  return (
    <Section id="faq">
      <div className="grid gap-10 lg:grid-cols-3 lg:gap-16">
        <SectionHeading
          title="Questions, answered"
          description="Short answers to the things people ask most."
          className="self-start lg:sticky lg:top-28"
        />

        <Accordion
          type="single"
          collapsible
          defaultValue={faqItems[0].q}
          className="border-t border-black/10 lg:col-span-2"
        >
          {faqItems.map((item) => (
            <AccordionItem key={item.q} value={item.q} className="border-black/10 last:border-b">
              <AccordionTrigger className="py-5 font-sans text-base font-semibold text-neutral-900 hover:no-underline sm:text-lg">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="pr-8 pb-5 text-base leading-relaxed text-neutral-600">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Section>
  );
}
