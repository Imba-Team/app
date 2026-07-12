import { useParams } from 'react-router-dom';

export function SetDetailRoute() {
  const { setId } = useParams<{ setId: string }>();
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Set detail</h1>
      <p className="text-muted-foreground">
        Editing set <code>{setId}</code>. Card list + editor lands with study module (Step B5).
      </p>
    </div>
  );
}
