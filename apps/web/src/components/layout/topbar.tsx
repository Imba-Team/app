import { LogOut, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/api/hooks/auth-context';
import { useLogout } from '@/lib/api/hooks/use-auth';

export function Topbar() {
  const { currentUser } = useAuth();
  const logout = useLogout();

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4">
      <div className="text-sm text-muted-foreground">
        Signed in as{' '}
        <span className="font-medium text-foreground">
          {currentUser?.name ?? currentUser?.email ?? '—'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button asChild variant="ghost" size="sm">
          <Link to="/settings/account">
            <Settings className="size-4" />
            Settings
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
      </div>
    </header>
  );
}
