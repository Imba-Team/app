import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';

import { StatusScreen } from './status-screen';

interface Props {
  /** Explain the required role or ownership. Defaults to a generic message. */
  description?: string;
}

/**
 * Rendered when a route or component detects the current user lacks the
 * required role or ownership (SRS §4.2 permission matrix). Wired into RBAC
 * guards from Sprint 1 onwards.
 */
export function PermissionDenied({
  description = 'Your account does not have permission to view this page.',
}: Props) {
  return (
    <StatusScreen
      label="403"
      title="Access denied"
      description={description}
      icon={Lock}
      action={
        <Button asChild>
          <Link to="/">Back to dashboard</Link>
        </Button>
      }
    />
  );
}
