import SetEditClient from "./SetEditClient";

export default async function SetEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SetEditClient id={id} />;
}
