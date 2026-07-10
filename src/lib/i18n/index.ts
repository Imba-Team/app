import i18n, { type i18n as I18nInstance, type InitOptions } from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import {
  defaultNamespace,
  namespaces,
  resources,
  supportedLocales,
  type SupportedLocale,
} from './resources.js';

export {
  defaultNamespace,
  isRtl,
  namespaces,
  resources,
  rtlLocales,
  supportedLocales,
} from './resources.js';
export type { Namespace, SupportedLocale } from './resources.js';

export interface CreateI18nOptions {
  /**
   * Skip browser detection and force a specific locale.
   * Useful for tests and Storybook. In dev/prod we let the detector pick.
   */
  lng?: SupportedLocale;
  /** Falls back to English when a key is missing. */
  fallbackLng?: SupportedLocale;
  /** Additional i18next init options merged after defaults. */
  extra?: Partial<InitOptions>;
}

/**
 * Create a fresh i18next instance preloaded with all Mimir locale bundles.
 * When `lng` is omitted, LanguageDetector picks from (in order):
 *   1. localStorage `mimir.i18n.lng`
 *   2. navigator.language / navigator.languages
 *   3. HTML lang attribute
 * — clamped to `supportedLocales`, else falls back to English.
 */
export function createI18n(options: CreateI18nOptions = {}): I18nInstance {
  const instance = i18n.createInstance();
  const useDetector = options.lng === undefined;

  const init: InitOptions = {
    resources,
    fallbackLng: options.fallbackLng ?? 'en',
    supportedLngs: [...supportedLocales],
    defaultNS: defaultNamespace,
    ns: [...namespaces],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'mimir.i18n.lng',
      caches: ['localStorage'],
    },
    ...options.extra,
  };

  if (options.lng !== undefined) {
    init.lng = options.lng;
  }

  if (useDetector) {
    instance.use(LanguageDetector);
  }
  void instance.init(init);
  return instance;
}
