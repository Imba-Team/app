import TestModeClient from './TestModeClient';

export default async function TestModePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TestModeClient moduleId={id} />;
}
