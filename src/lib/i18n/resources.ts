import az from './locales/az/common.json' with { type: 'json' };
import de from './locales/de/common.json' with { type: 'json' };
import en from './locales/en/common.json' with { type: 'json' };
import es from './locales/es/common.json' with { type: 'json' };
import fr from './locales/fr/common.json' with { type: 'json' };
import ru from './locales/ru/common.json' with { type: 'json' };

export const supportedLocales = ['en', 'es', 'de', 'az', 'ru', 'fr'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

/**
 * Right-to-left locales.
 * None in the current set (en, es, de, az, ru, fr are all LTR).
 * Kept as scaffolding so `isRtl()` callers stay stable if an RTL locale is added later.
 */
export const rtlLocales: readonly SupportedLocale[] = [];

export function isRtl(locale: SupportedLocale): boolean {
  return rtlLocales.includes(locale);
}

export const resources = {
  en: { common: en },
  es: { common: es },
  de: { common: de },
  az: { common: az },
  ru: { common: ru },
  fr: { common: fr },
} as const;
