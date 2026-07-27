import { BookOpenCheck, Lock, ServerCog, Code2 } from 'lucide-react';

const ITEMS = [
  { icon: BookOpenCheck, label: 'SM-2 open algorithm' },
  { icon: ServerCog, label: 'Self-hosted storage' },
  { icon: Lock, label: 'Secure auth by default' },
  { icon: Code2, label: 'OpenAPI documented' },
];

export default function TrustStrip() {
  return (
    <section className="border-y border-black/5 py-8">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        {ITEMS.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-3 text-sm font-medium text-neutral-700"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-brand-500/10 text-brand-500">
              <Icon className="h-4 w-4" />
            </span>
            {label}
          </div>
        ))}
      </div>
    </section>
  );
}
