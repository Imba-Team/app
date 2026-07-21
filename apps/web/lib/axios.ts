import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '@/lib/env';

type RetriableRequest = InternalAxiosRequestConfig & { _retry?: boolean };

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

apiClient.interceptors.request.use(
  (config) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

const REFRESH_URL = '/auth/refresh';
const NO_REFRESH_URLS = new Set([REFRESH_URL, '/auth/login', '/auth/register', '/auth/logout']);

let refreshPromise: Promise<void> | null = null;

async function refreshSession(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = apiClient
      .post(REFRESH_URL)
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`,
        response.status,
      );
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequest | undefined;
    const status = error.response?.status;
    const url = originalRequest?.url ?? '';

    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !NO_REFRESH_URLS.has(url)
    ) {
      originalRequest._retry = true;
      try {
        await refreshSession();
        return apiClient.request(originalRequest as AxiosRequestConfig);
      } catch {
        // Fall through to normal 401 handling below.
      }
    }

    if (process.env.NODE_ENV === 'development' && error.response) {
      const { status: s, data } = error.response;
      console.error(`[API Error] ${s}:`, data);
    } else if (process.env.NODE_ENV === 'development' && error.request) {
      console.error('Network error - no response from server');
    }

    return Promise.reject(error);
  },
);
