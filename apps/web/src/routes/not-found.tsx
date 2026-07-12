import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';

import { StatusScreen } from '@/components/feedback';
import { Button } from '@/components/ui/button';

export function NotFoundRoute() {
  return (
    <StatusScreen
      label="404"
      title="Page not found"
      description="We couldn't find what you were looking for."
      icon={Compass}
      action={
        <Button asChild>
          <Link to="/">Back to dashboard</Link>
        </Button>
      }
    />
  );
}
