import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';

export function NotFoundRoute() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="max-w-md text-muted-foreground">
        We couldn&apos;t find what you were looking for.
      </p>
      <Button asChild>
        <Link to="/">Back to dashboard</Link>
      </Button>
    </div>
  );
}
