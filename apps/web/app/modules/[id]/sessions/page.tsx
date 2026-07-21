import SessionsPageClient from "./SessionsPageClient";

export default async function SessionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SessionsPageClient moduleId={id} />;
}
