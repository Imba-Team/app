'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Settings, User2 } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Skeleton } from './ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useMe } from '@/lib/hooks/useUser';
import { buildAssetUrl } from '@/lib/env';
import { cn } from '@/lib/utils';

type NavLink = { label: string; href: string };

const APP_LINKS: NavLink[] = [
  { label: 'Library', href: '/library' },
  { label: 'Discover', href: '/discover' },
  { label: 'Review', href: '/srs' },
];

const LANDING_LINKS: NavLink[] = [
  { label: 'About', href: '#about' },
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
  const { isAuthenticated, isLoading } = useAuth();
  const { data: me } = useMe();

  const links = variant === 'app' ? APP_LINKS : LANDING_LINKS;
  const profilePictureUrl = buildAssetUrl(me?.profilePicture) || '';
  const hasProfilePicture = Boolean(me?.profilePicture);

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
        <Link
          href="/"
          className="px-5 py-2 text-xl font-bold text-neutral-700 hover:bg-neutral-50 rounded-full transition-colors"
        >
          Mimir
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-3">
          <nav className="flex h-11 items-center gap-1 rounded-full border border-black/5 bg-white p-1">
            {links.map((link) => {
              const active = isRouteActive(link.href, pathname);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'rounded-full px-10 py-2 text-sm font-medium transition-colors',
                    active ? 'bg-neutral-900 text-white' : 'text-neutral-800 hover:bg-black/5',
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {variant === 'app' ? (
            <AppActions
              isLoading={isLoading}
              avatarSrc={profilePictureUrl}
              avatarAlt={me?.name}
              hasProfilePicture={hasProfilePicture}
            />
          ) : (
            <LandingActions
              isLoading={isLoading}
              isAuthenticated={isAuthenticated}
              avatarSrc={profilePictureUrl}
              avatarAlt={me?.name}
              hasProfilePicture={hasProfilePicture}
            />
          )}
        </div>
      </div>
    </header>
  );
}

const pillBase =
  'inline-flex h-11 items-center justify-center rounded-full border border-black/5 bg-white text-neutral-800 transition-colors hover:bg-black/5';
const iconPill = `${pillBase} w-11`;
const textPill = `${pillBase} gap-2 px-4 text-sm font-medium`;
const avatarPill = `${pillBase} w-11 p-1`;

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
    <span className="flex size-9 items-center justify-center rounded-full">
      <User2 className="size-4" />
    </span>
  );
}

function AppActions({
  isLoading,
  avatarSrc,
  avatarAlt,
  hasProfilePicture,
}: {
  isLoading: boolean;
  avatarSrc: string;
  avatarAlt?: string;
  hasProfilePicture: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Link href="/account" aria-label="Settings" className={textPill}>
        <Settings className="size-4" />
        <span>Settings</span>
      </Link>
      <button type="button" aria-label="Notifications" className={iconPill}>
        <Bell className="h-4 w-4" />
      </button>
      <Link href="/account" aria-label="Profile" className={avatarPill}>
        <ProfileAvatar
          isLoading={isLoading}
          hasProfilePicture={hasProfilePicture}
          avatarSrc={avatarSrc}
          avatarAlt={avatarAlt}
        />
      </Link>
    </div>
  );
}

function LandingActions({
  isLoading,
  isAuthenticated,
  avatarSrc,
  avatarAlt,
  hasProfilePicture,
}: {
  isLoading: boolean;
  isAuthenticated: boolean;
  avatarSrc: string;
  avatarAlt?: string;
  hasProfilePicture: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-11 w-24 rounded-full" />;
  }

  if (isAuthenticated) {
    return (
      <Link href="/dashboard" aria-label="Profile" className={avatarPill}>
        <ProfileAvatar
          hasProfilePicture={hasProfilePicture}
          avatarSrc={avatarSrc}
          avatarAlt={avatarAlt}
        />
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link href="/login" className={`${textPill} gap-0 px-5`}>
        Log in
      </Link>
      <Link
        href="/register"
        className="inline-flex h-11 items-center rounded-full bg-black px-5 text-sm font-medium text-white transition-colors hover:bg-black/90"
      >
        Sign up
      </Link>
    </div>
  );
}
