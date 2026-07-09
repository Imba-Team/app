import { useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';

import { createI18n, type SupportedLocale } from '@/lib/i18n';

interface Props {
  children: ReactNode;
  locale?: SupportedLocale;
}

export function I18nProvider({ children, locale = 'en' }: Props) {
  const [instance] = useState(() => createI18n({ lng: locale }));
  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
