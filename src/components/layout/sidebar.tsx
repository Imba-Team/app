import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { BookOpen, Compass, GraduationCap, Home, Library, LineChart, Sparkles } from 'lucide-react';

import { cn } from '@/lib/cn';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const navItems: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/classroom', label: 'Classroom', icon: GraduationCap },
  { to: '/progress', label: 'Progress', icon: LineChart },
  { to: '/demo', label: 'Components', icon: Sparkles },
];

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r bg-card md:flex md:flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <BookOpen className="size-5 text-primary" />
        <span className="text-lg font-semibold">Mimir</span>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end ?? false}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
