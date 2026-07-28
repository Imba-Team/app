'use client';

import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { AuthProvider } from '@/contexts/AuthContext';
import { QueryProvider } from '@/lib/providers/QueryProvider';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname.includes('/login') || pathname.includes('/register');
  const variant = pathname === '/' ? 'landing' : 'app';

  return (
    <QueryProvider>
      <AuthProvider>
        {!isAuthPage && <Navbar variant={variant} />}
        {children}
      </AuthProvider>
    </QueryProvider>
  );
}
