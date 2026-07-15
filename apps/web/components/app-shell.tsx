'use client';

import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import { AuthProvider } from '@/contexts/AuthContext';
import { QueryProvider } from '@/lib/providers/QueryProvider';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname.includes('/login') || pathname.includes('/register');

  return (
    <QueryProvider>
      <AuthProvider>
        {!isAuthPage && <Header />}
        {children}

        {!isAuthPage && (
          <footer className="fixed bottom-0 w-full border-t border-border bg-background/95 py-4 text-center text-sm text-muted-foreground backdrop-blur">
            <p>&copy; {new Date().getFullYear()} Imba Learn. All rights reserved.</p>
          </footer>
        )}
      </AuthProvider>
    </QueryProvider>
  );
}
