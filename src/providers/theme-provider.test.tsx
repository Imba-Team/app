import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider, useTheme } from './theme-provider';

function wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql: MediaQueryList = {
    matches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: ((_evt: string, cb: EventListenerOrEventListenerObject) =>
      listeners.add(cb as (e: MediaQueryListEvent) => void)) as MediaQueryList['addEventListener'],
    removeEventListener: ((_evt: string, cb: EventListenerOrEventListenerObject) =>
      listeners.delete(
        cb as (e: MediaQueryListEvent) => void,
      )) as MediaQueryList['removeEventListener'],
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => true,
  };
  vi.stubGlobal('matchMedia', () => mql);
  return {
    mql,
    fireChange(next: boolean) {
      (mql as { matches: boolean }).matches = next;
      listeners.forEach((cb) => cb({ matches: next } as MediaQueryListEvent));
    },
  };
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = '';
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to system theme when nothing is stored', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('reads a stored preference on mount', () => {
    window.localStorage.setItem('mimir.theme', 'dark');
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('persists setTheme() and updates the html class', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => result.current.setTheme('dark'));
    expect(result.current.resolvedTheme).toBe('dark');
    expect(window.localStorage.getItem('mimir.theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);

    act(() => result.current.setTheme('light'));
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('follows the OS preference live when set to system', () => {
    const mm = mockMatchMedia(false);
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.resolvedTheme).toBe('light');

    act(() => mm.fireChange(true));
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('throws when useTheme is used outside the provider', () => {
    // Silence the expected React error boundary output.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Consumer() {
      useTheme();
      return null;
    }
    expect(() => render(<Consumer />)).toThrow(/useTheme must be used inside/);
  });

  it('renders children unchanged', () => {
    render(
      <ThemeProvider>
        <span>hello</span>
      </ThemeProvider>,
    );
    expect(screen.getByText('hello')).toBeInTheDocument();
  });
});
