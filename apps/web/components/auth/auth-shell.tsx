"use client";

/**
 * Two-column shell shared by /login and /register.
 *
 *   ┌───────────────────────┬─────────────────────┐
 *   │  form (children)      │  image + logo       │
 *   │                       │                     │
 *   │  ...                  │                     │
 *   │                       │  headline caption   │
 *   │  bottom bar           │                     │
 *   └───────────────────────┴─────────────────────┘
 *
 * On <md the right column is hidden and the logo moves inline above
 * the form.
 */

import Image from "next/image";
import Link from "next/link";
import loginImage from "@/components/images/log.jpeg";

export interface AuthShellProps {
  children: React.ReactNode;
  switcherHref: string;
  switcherPrompt: string;
  switcherLabel: string;
  headline?: React.ReactNode;
}

export function AuthShell({
  children,
  switcherHref,
  switcherPrompt,
  switcherLabel,
  headline,
}: AuthShellProps) {
  return (
    <main className="min-h-screen bg-white p-3 md:p-5">
      <div className="grid min-h-[calc(100vh-1.5rem)] md:min-h-[calc(100vh-2.5rem)] grid-cols-1 md:grid-cols-2 gap-0 md:gap-6">
        {/* Left column — form */}
        <div className="flex flex-col p-6 md:p-8">
          {/* Top-left logo, shared by mobile + desktop */}
          <div className="mb-4">
            <BrandMark />
          </div>

          <div className="flex-1 flex items-center justify-center py-6">
            {children}
          </div>

          <BottomBar
            switcherHref={switcherHref}
            switcherPrompt={switcherPrompt}
            switcherLabel={switcherLabel}
          />
        </div>

        {/* Right column — image */}
        <div className="relative hidden md:block rounded-3xl overflow-hidden">
          <Image
            src={loginImage}
            alt=""
            fill
            priority
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/40" />
          {headline && (
            <div className="absolute bottom-8 left-8 right-8 z-10 text-white drop-shadow-sm">
              {headline}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function BrandMark() {
  return (
    <Link
      href="/"
      aria-label="Mimir home"
      className="inline-flex items-center rounded-full px-4 py-2 text-lg font-bold text-neutral-900 transition-colors hover:bg-neutral-100"
    >
      Mimir
    </Link>
  );
}

function BottomBar({
  switcherHref,
  switcherPrompt,
  switcherLabel,
}: {
  switcherHref: string;
  switcherPrompt: string;
  switcherLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm pt-6 border-t border-gray-100">
      <p className="text-gray-500">
        {switcherPrompt}{" "}
        <Link
          href={switcherHref}
          className="font-semibold text-brand-500 hover:underline"
        >
          {switcherLabel}
        </Link>
      </p>
      <Link
        href="/terms"
        className="text-gray-500 hover:text-brand-500 hover:underline"
      >
        Terms &amp; Conditions
      </Link>
    </div>
  );
}
