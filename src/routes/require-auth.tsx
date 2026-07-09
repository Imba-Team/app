import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '@/lib/api/hooks/auth-context';

/**
 * Redirects to /login when there is no authenticated user in context.
 * The public routes (/login, /register) skip this guard.
 *
 * Note: `currentUser === null` is the "not logged in" signal used everywhere.
 * The refresh flow (in AppAuthProvider) will populate currentUser silently
 * on a valid HttpOnly refresh cookie, so a hard reload keeps you logged in.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}
