import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/api/hooks/auth-context';

export function DashboardRoute() {
  const { currentUser } = useAuth();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">
          Welcome back{currentUser?.name ? `, ${currentUser.name}` : ''}
        </h1>
        <p className="text-muted-foreground">Your study queue and recent sets will land here.</p>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>SRS due today</CardTitle>
            <CardDescription>Wired in Step B5 (SRS module).</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-muted-foreground">—</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cards mastered</CardTitle>
            <CardDescription>Wired via mastery engine (TDD §8a).</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-muted-foreground">—</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Study streak</CardTitle>
            <CardDescription>Populated from analytics events.</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-muted-foreground">—</CardContent>
        </Card>
      </div>
    </div>
  );
}
