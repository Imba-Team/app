'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const ITEMS = [
  {
    q: 'What is spaced repetition?',
    a: 'Spaced repetition is a review schedule that spaces cards further apart the better you know them, and pulls them back in when you start to forget. Mimir uses SM-2, a peer-reviewed algorithm with a 30+ year track record.',
  },
  {
    q: 'How is Mimir different from Quizlet or Anki?',
    a: 'Mimir layers a mastery state machine on top of SRS, so different study modes count toward mastery at different weights. You get the scheduling rigor of Anki with a modern, collaborative interface.',
  },
  {
    q: 'Is my data private?',
    a: 'Yes. Sets can be Public, Unlisted or Private. Passwords are hashed with bcrypt, refresh tokens live in HttpOnly cookies, and storage is self-hostable — no third-party vendor lock-in.',
  },
  {
    q: 'Can I study with classmates?',
    a: 'Yes. Invite collaborators as Owner, Editor or Viewer, and leave threaded comments on any set. Public sets are discoverable through search.',
  },
  {
    q: 'Is Mimir free?',
    a: 'The core study experience is free while we build out the platform. Advanced features like AI generation and imports will roll out over time.',
  },
];

export default function Faq() {
  return (
    <section id="faq" className="flex flex-col gap-8">
      <div className="max-w-2xl">
        <h2 className="text-3xl font-bold text-neutral-900 sm:text-4xl">
          Frequently asked questions
        </h2>
        <p className="mt-3 text-neutral-600">
          Short answers to the things people ask most.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col divide-y divide-black/5">
          {ITEMS.map((item, i) => (
            <FaqRow key={item.q} q={item.q} a={item.a} defaultOpen={i === 0} />
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

function FaqRow({
  q,
  a,
  defaultOpen = false,
}: {
  q: string;
  a: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="py-4 first:pt-2 last:pb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 text-left"
        aria-expanded={open}
      >
        <span className="font-semibold text-neutral-900">{q}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-neutral-500 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && <p className="mt-2 pr-8 text-sm text-neutral-600">{a}</p>}
    </div>
  );
}
