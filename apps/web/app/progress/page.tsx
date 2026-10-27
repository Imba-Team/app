import type { Metadata } from 'next';

import { ProgressPageClient } from './progressPageClient';

export const metadata: Metadata = {
  title: 'Progress · Mimir',
};

export default function ProgressPage() {
  return <ProgressPageClient />;
}
