import axios, { type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';

import type { TokenStore } from './token-store.js';

export interface CreateApiClientOptions {
  /** e.g. https://api.mimir.app or http://localhost:3000 */
  baseURL: string;
  /** Where the access token lives. */
  tokens: TokenStore;
  /**
   * Called when the access token has expired and the refresh flow should run.
   * Return the fresh access token to store + attach as Bearer.
   * Return `''` when the backend rotated an HttpOnly cookie (no Bearer token needed).
   * Return `null` (or throw) to signal that the session is dead and the user must re-login.
   */
  refresh: () => Promise<string | null>;
  /** Called when refresh fails — e.g. clear auth state, navigate to /login. */
  onAuthFailure?: () => void;
  /** Any extra axios options (headers, timeout, etc.). */
  axios?: AxiosRequestConfig;
}

type PendingRequest = {
  /** Token to attach on retry — empty string means "cookie handles auth, no Bearer". */
  resolve: (value: string) => void;
  reject: (reason: unknown) => void;
};

/**
 * Builds an axios client with automatic access-token attachment + refresh-on-401.
 *
 * Concurrent 401s share a single refresh call. If refresh fails, queued requests reject
 * and `onAuthFailure` fires exactly once. This fixes the shape-mismatch bug in the
 * v1.0-1.3 TDD (§11.2), which pushed only { res, rej } and lost the failed config.
 */
export function createApiClient(options: CreateApiClientOptions): AxiosInstance {
  const client = axios.create({
    baseURL: options.baseURL,
    withCredentials: true,
    ...options.axios,
  });

  let isRefreshing = false;
  let queue: PendingRequest[] = [];

  const flushQueue = (error: unknown, token: string | null) => {
    // token === null → refresh failed, reject waiters.
    // token === '' or truthy → refresh succeeded, resolve waiters (empty = cookie session).
    queue.forEach((p) => (token !== null ? p.resolve(token) : p.reject(error)));
    queue = [];
  };

  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = options.tokens.getAccessToken();
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => {
      // Unwrap the backend's { ok, message, data } envelope so hooks see just the payload.
      // No-op for endpoints that don't use the envelope (response body kept as-is).
      const body = response.data as unknown;
      if (
        body !== null &&
        typeof body === 'object' &&
        'ok' in body &&
        'data' in body &&
        typeof (body as { ok: unknown }).ok === 'boolean'
      ) {
        response.data = (body as { data: unknown }).data;
      }
      return response;
    },
    async (error) => {
      // Also unwrap envelope on error responses so `error.response.data.message` still works.
      const errBody = error?.response?.data as unknown;
      if (
        errBody !== null &&
        typeof errBody === 'object' &&
        'ok' in errBody &&
        'data' in errBody &&
        typeof (errBody as { ok: unknown }).ok === 'boolean'
      ) {
        error.response.data = (errBody as { data: unknown }).data ?? errBody;
      }

      const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };

      if (error.response?.status !== 401 || original._retried) {
        return Promise.reject(error);
      }
      original._retried = true;

      if (isRefreshing) {
        // Wait for the in-flight refresh, then replay this request with the new token
        // (or without a Bearer header if it was a cookie-session refresh).
        return new Promise<string>((resolve, reject) => queue.push({ resolve, reject })).then(
          (token) => {
            if (token) {
              original.headers.set('Authorization', `Bearer ${token}`);
            } else {
              original.headers.delete('Authorization');
            }
            return client(original);
          },
        );
      }

      isRefreshing = true;
      try {
        const newToken = await options.refresh();
        if (newToken === null) throw new Error('Refresh returned no token');
        // Empty string means the backend rotated a cookie — no Bearer to attach.
        options.tokens.setAccessToken(newToken || null);
        flushQueue(null, newToken);
        if (newToken) {
          original.headers.set('Authorization', `Bearer ${newToken}`);
        } else {
          original.headers.delete('Authorization');
        }
        return client(original);
      } catch (refreshError) {
        flushQueue(refreshError, null);
        options.tokens.setAccessToken(null);
        options.onAuthFailure?.();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    },
  );

  return client;
}
