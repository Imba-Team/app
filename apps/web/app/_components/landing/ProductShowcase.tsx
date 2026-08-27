import { CheckCircle2, Users } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

export default function ProductShowcase() {
  return (
    <section className="flex flex-col gap-16 sm:gap-24">
      <ShowcaseRow
        eyebrow="Progress you can trust"
        title="A mastery engine that separates knowing from guessing"
        body="Each study mode contributes to mastery at a different weight. Recall-heavy modes like Write count more than recognition, so your mastery score reflects real learning — not muscle memory."
        visual={<MasteryMock />}
      />
      <ShowcaseRow
        reverse
        eyebrow="Plan your week"
        title="See what's due — today, tomorrow and 30 days out"
        body="The forecast tells you exactly how many cards are coming due each day, so you can pace your studying instead of drowning in a backlog."
        visual={<ForecastMock />}
      />
      <ShowcaseRow
        eyebrow="Learn together"
        title="Study sets built for collaboration"
        body="Invite classmates as editors or viewers. Leave threaded comments on any set. Keep public sets discoverable and private sets locked down."
        visual={<CollabMock />}
      />
    </section>
  );
}

function ShowcaseRow({
  eyebrow,
  title,
  body,
  visual,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
      <div className={reverse ? 'md:order-2' : ''}>
        <p className="text-xs font-medium uppercase tracking-wide text-brand-500">
          {eyebrow}
        </p>
        <h3 className="mt-2 text-2xl font-bold text-neutral-900 sm:text-3xl">{title}</h3>
        <p className="mt-4 text-neutral-600">{body}</p>
      </div>
      <div className={reverse ? 'md:order-1' : ''}>{visual}</div>
    </div>
  );
}

// Mock 1: mastery progress bar with counts
function MasteryMock() {
  return (
    <Card className="border border-black/5 shadow-md shadow-black/5">
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-neutral-900">Cognitive Science 101</p>
          <span className="text-xs text-neutral-500">124 cards</span>
        </div>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-neutral-100">
          <div className="h-full bg-emerald-500" style={{ width: '52%' }} />
          <div className="h-full bg-brand-400" style={{ width: '30%' }} />
          <div className="h-full bg-neutral-300" style={{ width: '18%' }} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <MiniStat tone="emerald" label="Mastered" value="64" />
          <MiniStat tone="brand" label="Learning" value="38" />
          <MiniStat tone="neutral" label="New" value="22" />
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({
  tone,
  label,
  value,
}: {
  tone: 'emerald' | 'brand' | 'neutral';
  label: string;
  value: string;
}) {
  const dot =
    tone === 'emerald'
      ? 'bg-emerald-500'
      : tone === 'brand'
        ? 'bg-brand-400'
        : 'bg-neutral-300';
  return (
    <div className="rounded-xl bg-neutral-50 py-2">
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-500">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </div>
      <p className="mt-0.5 text-lg font-bold text-neutral-900">{value}</p>
    </div>
  );
}

// Mock 2: 30-day forecast bar chart
function ForecastMock() {
  const bars = [12, 18, 22, 9, 14, 26, 30, 20, 15, 24, 28, 17, 11, 19];
  const max = Math.max(...bars);
  return (
    <Card className="border border-black/5 shadow-md shadow-black/5">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-neutral-900">Next 14 days</p>
          <span className="text-xs text-neutral-500">253 due</span>
        </div>
        <div className="flex h-32 items-end gap-1.5">
          {bars.map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-brand-500/80"
              style={{ height: `${(v / max) * 100}%` }}
            />
          ))}
        </div>
        <p className="text-xs text-neutral-500">
          Peak day: 30 cards — plan a longer session or spread across two days.
        </p>
      </CardContent>
    </Card>
  );
}

// Mock 3: collaborator rows
function CollabMock() {
  const people = [
    { name: 'Emin D.', role: 'Owner', tone: 'brand' as const },
    { name: 'Leyla A.', role: 'Editor', tone: 'emerald' as const },
    { name: 'Diana K.', role: 'Viewer', tone: 'neutral' as const },
  ];
  return (
    <Card className="border border-black/5 shadow-md shadow-black/5">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2 pb-1">
          <Users className="h-4 w-4 text-brand-500" />
          <p className="font-semibold text-neutral-900">Collaborators</p>
        </div>
        {people.map((p) => (
          <div
            key={p.name}
            className="flex items-center justify-between rounded-xl bg-neutral-50 px-3 py-2"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/10 text-xs font-semibold text-brand-500">
                {p.name.split(' ')[0][0]}
              </div>
              <span className="text-sm font-medium text-neutral-900">{p.name}</span>
            </div>
            <RoleTag tone={p.tone} label={p.role} />
          </div>
        ))}
        <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          Comments enabled
        </div>
      </CardContent>
    </Card>
  );
}

function RoleTag({
  tone,
  label,
}: {
  tone: 'brand' | 'emerald' | 'neutral';
  label: string;
}) {
  const cls = {
    brand: 'bg-brand-500/10 text-brand-500',
    emerald: 'bg-emerald-50 text-emerald-600',
    neutral: 'bg-neutral-100 text-neutral-600',
  }[tone];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}
