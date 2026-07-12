import { useParams } from 'react-router-dom';

export function SetStudyRoute() {
  const { setId, mode } = useParams<{ setId: string; mode: string }>();
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Studying: {mode}</h1>
      <p className="text-muted-foreground">
        Set <code>{setId}</code> → mode <code>{mode}</code>. The XState machine for this mode lives
        in <code>@/lib/study/machines/</code>; the session controller drops in Step B5.
      </p>
    </div>
  );
}
