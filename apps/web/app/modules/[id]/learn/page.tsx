import LearnModeClient from "./LearnModeClient";

export default async function LearnModePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LearnModeClient moduleId={id} />;
}
