import i18n, { type i18n as I18nInstance, type InitOptions } from 'i18next';

import { resources, supportedLocales, type SupportedLocale } from './resources.js';

export { resources, supportedLocales, rtlLocales, isRtl } from './resources.js';
export type { SupportedLocale } from './resources.js';

export interface CreateI18nOptions {
  /** Locale to load first. Defaults to 'en'. */
  lng?: SupportedLocale;
  /** Falls back to English when a key is missing. */
  fallbackLng?: SupportedLocale;
  /** Additional i18next init options merged after defaults. */
  extra?: Partial<InitOptions>;
}

/**
 * Create a fresh i18next instance preloaded with all Mimir locale bundles.
 * Web and mobile each call this once at boot; server rendering (if added later)
 * can call it per-request.
 */
export function createI18n(options: CreateI18nOptions = {}): I18nInstance {
  const instance = i18n.createInstance();
  void instance.init({
    resources,
    lng: options.lng ?? 'en',
    fallbackLng: options.fallbackLng ?? 'en',
    supportedLngs: [...supportedLocales],
    defaultNS: 'common',
    ns: ['common'],
    interpolation: { escapeValue: false },
    ...options.extra,
  });
  return instance;
}
