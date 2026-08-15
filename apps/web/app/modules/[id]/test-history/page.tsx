import TestHistoryPageClient from './TestHistoryPageClient';

export default async function TestHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TestHistoryPageClient moduleId={id} />;
}
