import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMemoryTokenStore } from './token-store';

/**
 * Regression guard for the FR-AUTH-011 hardening requirement: the access token
 * MUST live in memory only. If a future refactor accidentally starts persisting
 * to localStorage / sessionStorage / cookies, these tests fail.
 */
describe('memory token store — no leakage to browser storage', () => {
  let localSetItem: ReturnType<typeof vi.spyOn>;
  let sessionSetItem: ReturnType<typeof vi.spyOn>;
  let documentCookieSet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localSetItem = vi.spyOn(Storage.prototype, 'setItem');
    sessionSetItem = vi.spyOn(Storage.prototype, 'setItem');
    documentCookieSet = vi.fn();
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      set: documentCookieSet,
      get: () => '',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('setAccessToken keeps the token in memory only', () => {
    const store = createMemoryTokenStore();
    store.setAccessToken('secret-access-token');

    expect(store.getAccessToken()).toBe('secret-access-token');
    expect(localSetItem).not.toHaveBeenCalled();
    expect(sessionSetItem).not.toHaveBeenCalled();
    expect(documentCookieSet).not.toHaveBeenCalled();
  });

  it('clearing sets to null without touching storage', () => {
    const store = createMemoryTokenStore();
    store.setAccessToken('x');
    store.setAccessToken(null);

    expect(store.getAccessToken()).toBeNull();
    expect(localSetItem).not.toHaveBeenCalled();
    expect(sessionSetItem).not.toHaveBeenCalled();
    expect(documentCookieSet).not.toHaveBeenCalled();
  });

  it('two instances are isolated (no shared global state)', () => {
    const a = createMemoryTokenStore();
    const b = createMemoryTokenStore();
    a.setAccessToken('token-a');
    b.setAccessToken('token-b');

    expect(a.getAccessToken()).toBe('token-a');
    expect(b.getAccessToken()).toBe('token-b');
  });
});
