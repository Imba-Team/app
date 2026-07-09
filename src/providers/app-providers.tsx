import type { ReactNode } from 'react';

import { I18nProvider } from './i18n-provider';
import { QueryProvider } from './query-provider';
import { AppAuthProvider } from './auth-provider';

/**
 * Composition root for every React provider the app needs.
 * Order matters: Query (data-plane) wraps Auth (which uses Query),
 * Auth wraps I18n so error toasts inside auth flows can be translated.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AppAuthProvider>
        <I18nProvider>{children}</I18nProvider>
      </AppAuthProvider>
    </QueryProvider>
  );
}
