import LearnModeClient from '../learn/learnModeClient';

// Write mode (MIM-19): Learn's batch flow with every prompt typed.
export default async function WriteModePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LearnModeClient moduleId={id} mode="WRITE" />;
}
