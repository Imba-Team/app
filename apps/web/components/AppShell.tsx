'use client';

import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import HtmlLangSync from '@/components/html-lang-sync';
import { AuthProvider } from '@/contexts/AuthContext';
import { CreateModuleDialogProvider } from '@/contexts/CreateModuleDialogContext';
import { QueryProvider } from '@/lib/providers/QueryProvider';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Standalone auth screens (login, register, and the /auth/* email-link
  // pages) render their own logo and must not show the signed-in navbar.
  const isAuthPage =
    pathname.includes('/login') ||
    pathname.includes('/register') ||
    pathname.startsWith('/auth/');
  const variant = pathname === '/' ? 'landing' : 'app';

  return (
    <QueryProvider>
      <AuthProvider>
        <CreateModuleDialogProvider>
          <HtmlLangSync />
          {!isAuthPage && <Navbar variant={variant} />}
          {children}
        </CreateModuleDialogProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
