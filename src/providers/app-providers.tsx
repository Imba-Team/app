import type { ReactNode } from 'react';
import { Toaster } from 'sonner';

import { I18nProvider } from './i18n-provider';
import { QueryProvider } from './query-provider';
import { AppAuthProvider } from './auth-provider';
import { ThemeProvider, useTheme } from './theme-provider';

/**
 * Composition root for every React provider the app needs.
 * Order: Theme (outermost so <ThemedToaster> can consume it) → Query (data-plane)
 * → Auth (uses Query) → I18n (so error toasts inside auth flows can be translated).
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AppAuthProvider>
          <I18nProvider>
            {children}
            <ThemedToaster />
          </I18nProvider>
        </AppAuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme} position="top-right" richColors closeButton />;
}
