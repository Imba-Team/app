'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, LogIn, LogOut, Moon, Plus, Settings, Sun, User2 } from 'lucide-react';

import { GlobalSearch } from '@/components/global-search';

import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Skeleton } from './ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateModuleDialog } from '@/contexts/CreateModuleDialogContext';
import { useMe } from '@/lib/hooks/useUser';
import { buildAssetUrl } from '@/lib/env';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

type NavLink = { label: string; href: string };

const APP_LINKS: NavLink[] = [
  { label: 'Library', href: '/library' },
  { label: 'Discover', href: '/discover' },
  { label: 'Review', href: '/srs' },
];

const LANDING_LINKS: NavLink[] = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
  { label: 'FAQ', href: '#faq' },
];

function isRouteActive(href: string, pathname: string) {
  if (href.startsWith('#')) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type NavbarVariant = 'landing' | 'app';

export default function Navbar({ variant }: { variant: NavbarVariant }) {
  const pathname = usePathname();
  const { isAuthenticated, isLoading, logout } = useAuth();
  const { data: me } = useMe();
  const scrolled = useHasScrolled();
  const createModule = useCreateModuleDialog();

  const links = variant === 'app' ? APP_LINKS : LANDING_LINKS;
  const profilePictureUrl = buildAssetUrl(me?.profilePicture) || '';
  const hasProfilePicture = Boolean(me?.profilePicture);

  // Logo target — dashboard for signed-in users inside the app, the
  // landing itself when we're on `/`. Non-authed users on internal
  // routes still go to `/` (login gate handles the rest).
  const logoHref = variant === 'app' && isAuthenticated ? '/dashboard' : '/';

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full transition-[background,box-shadow,backdrop-filter] duration-200',
        scrolled ? 'shadow-[0_1px_16px_-8px_rgba(0,0,0,0.15)] backdrop-blur' : 'bg-transparent',
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 md:px-8">
        <Link
          href={logoHref}
          className="rounded-full px-5 py-2 text-xl font-bold text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          Mimir
        </Link>

        {variant === 'app' && <GlobalSearch />}
        <div className="ml-auto flex items-center gap-3">
          {variant === 'app' && (
            <Button
              type="button"
              aria-label="Create module"
              className={iconPillClass}
              variant="navbar"
              onClick={() => createModule.open()}
            >
              <Plus className="size-4" />
            </Button>
          )}

          <SlideNav links={links} pathname={pathname} />

          {variant === 'app' ? (
            <AppActions
              isLoading={isLoading}
              displayName={me?.name}
              username={me?.username}
              email={me?.email}
              avatarSrc={profilePictureUrl}
              avatarAlt={me?.name}
              hasProfilePicture={hasProfilePicture}
              onLogout={logout}
            />
          ) : (
            <LandingActions
              isLoading={isLoading}
              isAuthenticated={isAuthenticated}
              displayName={me?.name}
              username={me?.username}
              email={me?.email}
              avatarSrc={profilePictureUrl}
              avatarAlt={me?.name}
              hasProfilePicture={hasProfilePicture}
              onLogout={logout}
            />
          )}
        </div>
      </div>
    </header>
  );
}

// ---------- Slide-tabs animated navigation ----------

type CursorPos = { left: number; width: number; opacity: number };
const HIDDEN_CURSOR: CursorPos = { left: 0, width: 0, opacity: 0 };

function SlideNav({ links, pathname }: { links: NavLink[]; pathname: string }) {
  const [position, setPosition] = useState<CursorPos>(HIDDEN_CURSOR);

  return (
    <ul
      onMouseLeave={() => setPosition((p) => ({ ...p, opacity: 0 }))}
      className="relative flex h-11 items-center gap-1 rounded-full border border-black/5 bg-white p-1"
    >
      {links.map((link) => (
        <NavTab
          key={link.href}
          link={link}
          active={isRouteActive(link.href, pathname)}
          setPosition={setPosition}
        />
      ))}
      <SlideCursor position={position} />
    </ul>
  );
}

function NavTab({
  link,
  active,
  setPosition,
}: {
  link: NavLink;
  active: boolean;
  setPosition: (pos: CursorPos) => void;
}) {
  const ref = useRef<HTMLLIElement>(null);

  return (
    <li
      ref={ref}
      onMouseEnter={() => {
        if (!ref.current) return;
        const { width } = ref.current.getBoundingClientRect();
        setPosition({ left: ref.current.offsetLeft, width, opacity: 1 });
      }}
      className="relative z-10"
    >
      <Link
        href={link.href}
        className={cn(
          'block rounded-full px-8 py-2 text-sm font-medium transition-colors',
          active ? 'bg-neutral-900 text-white' : 'text-neutral-800',
        )}
      >
        {link.label}
      </Link>
    </li>
  );
}

function SlideCursor({ position }: { position: CursorPos }) {
  return (
    <motion.li
      aria-hidden
      animate={position}
      transition={{ type: 'spring', stiffness: 500, damping: 34, mass: 0.6 }}
      className="pointer-events-none absolute inset-y-1 z-0 rounded-full bg-black/5"
    />
  );
}

// ---------- Scroll shadow ----------

function useHasScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}

// ---------- Profile menu ----------

type ProfileMenuProps = {
  displayName?: string;
  username?: string;
  email?: string;
  avatarSrc: string;
  avatarAlt?: string;
  hasProfilePicture: boolean;
  onLogout: () => void | Promise<void>;
  trigger: React.ReactNode;
};

// Local UI-only dark-mode toggle. Wiring it to a real theme provider is
// out of scope for this pass — the state persists per-mount and gets
// used purely for the icon flip. Swap for next-themes when the provider
// lands.
function useDarkModeStub() {
  const [dark, setDark] = useState(false);
  return { dark, toggle: () => setDark((v) => !v) };
}

function ProfileMenu({
  displayName,
  username,
  email,
  avatarSrc,
  avatarAlt,
  hasProfilePicture,
  onLogout,
  trigger,
}: ProfileMenuProps) {
  const { dark, toggle } = useDarkModeStub();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64 p-2">
        <div className="flex items-center gap-3 px-2 py-2 ">
          <ProfileAvatar
            hasProfilePicture={hasProfilePicture}
            avatarSrc={avatarSrc}
            avatarAlt={avatarAlt}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-neutral-900">
              {displayName || username || 'Signed in'}
            </p>
            {email && <p className="truncate text-xs text-neutral-500">{email}</p>}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={toggle}>
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {dark ? 'Light mode' : 'Dark mode'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onLogout()}>
          <LogOut className="h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const iconPillClass =
  'inline-flex size-9 items-center justify-center rounded-full bg-white text-neutral-800 transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20';

type AvatarProps = {
  isLoading?: boolean;
  hasProfilePicture: boolean;
  avatarSrc: string;
  avatarAlt?: string;
};

function ProfileAvatar({ isLoading, hasProfilePicture, avatarSrc, avatarAlt }: AvatarProps) {
  if (isLoading) {
    return <Skeleton className="size-9 rounded-full" />;
  }
  if (hasProfilePicture) {
    return (
      <Avatar className="size-9">
        <AvatarImage src={avatarSrc} alt={avatarAlt} crossOrigin="anonymous" />
        <AvatarFallback>
          <User2 className="size-4 text-neutral-500" />
        </AvatarFallback>
      </Avatar>
    );
  }
  return (
    <span className="flex size-10 items-center justify-center rounded-full bg-brand-500/10 text-brand-500">
      <User2 className="size-4" />
    </span>
  );
}

function AppActions({
  isLoading,
  displayName,
  username,
  email,
  avatarSrc,
  avatarAlt,
  hasProfilePicture,
  onLogout,
}: {
  isLoading: boolean;
  displayName?: string;
  username?: string;
  email?: string;
  avatarSrc: string;
  avatarAlt?: string;
  hasProfilePicture: boolean;
  onLogout: () => void | Promise<void>;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button type="button" aria-label="Notifications" className={iconPillClass} variant="navbar">
        <Bell className="size-4" />
      </Button>

      <ProfileMenu
        displayName={displayName}
        username={username}
        email={email}
        avatarSrc={avatarSrc}
        avatarAlt={avatarAlt}
        hasProfilePicture={hasProfilePicture}
        onLogout={onLogout}
        trigger={
          <Button
            type="button"
            variant="secondary"
            aria-label="Open profile menu"
            className="inline-flex size-11 items-center justify-center hover:bg-white"
          >
            <ProfileAvatar
              isLoading={isLoading}
              hasProfilePicture={hasProfilePicture}
              avatarSrc={avatarSrc}
              avatarAlt={avatarAlt}
            />
          </Button>
        }
      />
    </div>
  );
}

function LandingActions({
  isLoading,
  isAuthenticated,
  displayName,
  username,
  email,
  avatarSrc,
  avatarAlt,
  hasProfilePicture,
  onLogout,
}: {
  isLoading: boolean;
  isAuthenticated: boolean;
  displayName?: string;
  username?: string;
  email?: string;
  avatarSrc: string;
  avatarAlt?: string;
  hasProfilePicture: boolean;
  onLogout: () => void | Promise<void>;
}) {
  if (isLoading) {
    return <Skeleton className="h-11 w-48 rounded-full" />;
  }

  if (isAuthenticated) {
    return (
      <ProfileMenu
        displayName={displayName}
        username={username}
        email={email}
        avatarSrc={avatarSrc}
        avatarAlt={avatarAlt}
        hasProfilePicture={hasProfilePicture}
        onLogout={onLogout}
        trigger={
          <Button
            type="button"
            aria-label={`Continue as ${displayName ?? 'signed-in user'}`}
            className="h-9 flex px-1.5"
            variant="navbar"
          >
            <ProfileAvatar
              hasProfilePicture={hasProfilePicture}
              avatarSrc={avatarSrc}
              avatarAlt={avatarAlt}
            />
            <span className="text-sm font-medium">
              <span className="text-neutral-500">Continue as</span>{' '}
              <span className="text-neutral-900">{displayName || 'you'}</span>
            </span>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link href="/login">
        <Button variant="navbar" className="h-9">
          <LogIn className="mr-1 h-4 w-4" />
          Log in
        </Button>
      </Link>
      <Link href="/register">
        <Button variant="default">
          <LogIn className="mr-1 h-4 w-4" />
          Sign up
        </Button>
      </Link>
    </div>
  );
}
