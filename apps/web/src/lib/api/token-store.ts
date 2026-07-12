/**
 * Framework-agnostic access-token holder.
 *
 * The web app plugs an in-memory store (with a Zustand adapter);
 * the mobile app plugs an Expo SecureStore adapter for persistence across restarts.
 * The refresh token lives elsewhere (HttpOnly cookie on web; SecureStore on mobile).
 */
export interface TokenStore {
  getAccessToken(): string | null;
  setAccessToken(token: string | null): void;
}

/** Simple in-memory store — the web app's default. */
export function createMemoryTokenStore(): TokenStore {
  let token: string | null = null;
  return {
    getAccessToken: () => token,
    setAccessToken: (t) => {
      token = t;
    },
  };
}
