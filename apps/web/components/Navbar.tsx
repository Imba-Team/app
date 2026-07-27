'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, LogIn, Settings, User2 } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Skeleton } from './ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
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
  const { isAuthenticated, isLoading } = useAuth();
  const { data: me } = useMe();
  const scrolled = useHasScrolled();

  const links = variant === 'app' ? APP_LINKS : LANDING_LINKS;
  const profilePictureUrl = buildAssetUrl(me?.profilePicture) || '';
  const hasProfilePicture = Boolean(me?.profilePicture);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full transition-[background,box-shadow,backdrop-filter] duration-200',
        scrolled ? 'shadow-[0_1px_16px_-8px_rgba(0,0,0,0.15)] backdrop-blur' : 'bg-transparent',
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
        <Link
          href="/"
          className="rounded-full px-5 py-2 text-xl font-bold text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          Mimir
        </Link>

        <div className="flex items-center gap-3">
          <SlideNav links={links} pathname={pathname} />

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
              displayName={me?.name}
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
          'block rounded-full px-10 py-2 text-sm font-medium transition-colors',
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

// ---------- Profile + action pills ----------

const pillBase =
  'inline-flex h-11 items-center justify-center rounded-full border border-black/5 bg-white text-neutral-800 transition-colors hover:bg-black/5';
const iconPill = `${pillBase} w-9 h-9! border-0`;
const textPill = `${pillBase} gap-2 px-4 text-sm font-medium h-9! border-0`;
const avatarPill = `${pillBase} w-9! h-9! border-0`;

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
      <span className="rounded-full bg-white p-1">
        <Link href="/account" aria-label="Settings" className={textPill}>
          <Settings className="size-4" />
          <span>Settings</span>
        </Link>
      </span>
      <span className="rounded-full bg-white p-1">
        <button type="button" aria-label="Notifications" className={iconPill}>
          <Bell className="h-4 w-4" />
        </button>
      </span>
      <span className="rounded-full bg-white p-1">
        <Link href="/account" aria-label="Profile" className={avatarPill}>
          <ProfileAvatar
            isLoading={isLoading}
            hasProfilePicture={hasProfilePicture}
            avatarSrc={avatarSrc}
            avatarAlt={avatarAlt}
          />
        </Link>
      </span>
    </div>
  );
}

function LandingActions({
  isLoading,
  isAuthenticated,
  displayName,
  avatarSrc,
  avatarAlt,
  hasProfilePicture,
}: {
  isLoading: boolean;
  isAuthenticated: boolean;
  displayName?: string;
  avatarSrc: string;
  avatarAlt?: string;
  hasProfilePicture: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-11 w-48 rounded-full" />;
  }

  if (isAuthenticated) {
    return (
      <Link
        href="/dashboard"
        aria-label={`Continue as ${displayName ?? 'signed-in user'}`}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-black/5 bg-white pl-1 pr-4 text-neutral-800 transition-colors hover:bg-black/5"
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
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link href="/login">
        <Button variant="secondary">
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
