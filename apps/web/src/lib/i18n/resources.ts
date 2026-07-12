import azAuth from './locales/az/auth.json' with { type: 'json' };
import azCommon from './locales/az/common.json' with { type: 'json' };
import deAuth from './locales/de/auth.json' with { type: 'json' };
import deCommon from './locales/de/common.json' with { type: 'json' };
import enAuth from './locales/en/auth.json' with { type: 'json' };
import enCommon from './locales/en/common.json' with { type: 'json' };
import enStudy from './locales/en/study.json' with { type: 'json' };
import esAuth from './locales/es/auth.json' with { type: 'json' };
import esCommon from './locales/es/common.json' with { type: 'json' };
import frAuth from './locales/fr/auth.json' with { type: 'json' };
import frCommon from './locales/fr/common.json' with { type: 'json' };
import ruAuth from './locales/ru/auth.json' with { type: 'json' };
import ruCommon from './locales/ru/common.json' with { type: 'json' };

export const supportedLocales = ['en', 'es', 'de', 'az', 'ru', 'fr'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

/**
 * Feature-scoped namespaces. Consumers pick one via `useTranslation('auth')`.
 * New feature sprints add their own namespace (e.g. 'srs', 'classroom', 'ai')
 * by dropping locales/<lang>/<ns>.json alongside these and wiring it here.
 */
export const namespaces = ['common', 'auth', 'study'] as const;
export type Namespace = (typeof namespaces)[number];
export const defaultNamespace: Namespace = 'common';

/**
 * Right-to-left locales.
 * None in the current set — kept as scaffolding so `isRtl()` callers stay
 * stable if an RTL locale is added later.
 */
export const rtlLocales: readonly SupportedLocale[] = [];

export function isRtl(locale: SupportedLocale): boolean {
  return rtlLocales.includes(locale);
}

export const resources = {
  en: { common: enCommon, auth: enAuth, study: enStudy },
  es: { common: esCommon, auth: esAuth },
  de: { common: deCommon, auth: deAuth },
  az: { common: azCommon, auth: azAuth },
  ru: { common: ruCommon, auth: ruAuth },
  fr: { common: frCommon, auth: frAuth },
} as const;
