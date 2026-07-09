import { useParams } from 'react-router-dom';

export function ProfileRoute() {
  const { username } = useParams<{ username: string }>();
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">@{username}</h1>
      <p className="text-muted-foreground">
        Public profile view — sets, followers, 90-day heatmap. Backed by the auth + study modules.
      </p>
    </div>
  );
}
