import { apiClient } from '@/lib/axios';
import { isAxiosError } from 'axios';

export interface AuthStatus {
  isAuthenticated: boolean;
  needsRefresh: boolean;
}

function clearHintCookie() {
  if (typeof document !== 'undefined') {
    document.cookie = 'isLoggedIn=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  }
}

export async function checkAuth(): Promise<AuthStatus> {
  if (typeof document !== 'undefined' && !hasValidLoginCookie()) {
    return { isAuthenticated: false, needsRefresh: false };
  }

  try {
    await apiClient.get('/users/me');
    return { isAuthenticated: true, needsRefresh: false };
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) {
      return { isAuthenticated: false, needsRefresh: true };
    }
    console.error('Auth check failed:', error);
    return { isAuthenticated: false, needsRefresh: false };
  }
}

export async function clearAuthCookies(): Promise<boolean> {
  try {
    await apiClient.post('/auth/logout');
    clearHintCookie();
    return true;
  } catch (error) {
    console.error('Failed to clear auth cookies:', error);
    clearHintCookie();
    return false;
  }
}

/**
 * Gets the value of a specific cookie
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);

  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }

  return null;
}

/**
 * Checks if the isLoggedIn cookie exists and is set to true
 */
export function hasValidLoginCookie(): boolean {
  const isLoggedIn = getCookie('isLoggedIn');
  return isLoggedIn === 'true';
}
