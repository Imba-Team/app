import { describe, expect, it } from 'vitest';

import { createI18n } from './index';

describe('createI18n', () => {
  it('resolves keys from the requested namespace', () => {
    const i18n = createI18n({ lng: 'en' });
    expect(i18n.t('actions.save', { ns: 'common' })).toBe('Save');
    expect(i18n.t('loginTitle', { ns: 'auth' })).toBe('Welcome back');
    expect(i18n.t('modes.flashcards', { ns: 'study' })).toBe('Flashcards');
  });

  it('serves the requested locale and falls back to English for missing keys', () => {
    const i18n = createI18n({ lng: 'es' });
    expect(i18n.t('app.tagline', { ns: 'common' })).toBe('Aprendizaje de vocabulario con IA');
    expect(i18n.t('actions.signIn', { ns: 'auth' })).toBe('Iniciar sesión');
    // Spanish bundle doesn't ship 'study' — fall back to English.
    expect(i18n.t('modes.learn', { ns: 'study' })).toBe('Learn');
  });

  it('uses the browser detector when no lng is passed', () => {
    // No lng → LanguageDetector runs. In happy-dom, navigator.language is 'en-US'
    // which resolves to the 'en' bundle via supportedLngs.
    const i18n = createI18n();
    expect(i18n.language.startsWith('en')).toBe(true);
    expect(i18n.t('actions.save', { ns: 'common' })).toBe('Save');
  });
});
