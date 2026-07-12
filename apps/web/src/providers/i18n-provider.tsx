import { useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';

import { createI18n, type SupportedLocale } from '@/lib/i18n';

interface Props {
  children: ReactNode;
  /**
   * Force a locale (skips browser detection). Leave undefined in the app;
   * tests and Storybook can pass an explicit locale for stable snapshots.
   */
  locale?: SupportedLocale;
}

export function I18nProvider({ children, locale }: Props) {
  const [instance] = useState(() => createI18n(locale ? { lng: locale } : {}));
  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
