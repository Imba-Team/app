/**
 * Authentication utility functions for cookie and session management
 */

export interface AuthStatus {
  isAuthenticated: boolean;
  needsRefresh: boolean;
}

/**
 * Checks if the user is authenticated by making a request to the /users/me endpoint
 * This will validate if the cookies are still valid on the backend
 */
export async function checkAuth(): Promise<AuthStatus> {
  try {
    const res = await fetch("https://imba-server.up.railway.app/users/me", {
      method: "GET",
      credentials: "include",
    });

    if (res.ok) {
      return { isAuthenticated: true, needsRefresh: false };
    }

    // If unauthorized (401), the token has expired
    if (res.status === 401) {
      return { isAuthenticated: false, needsRefresh: true };
    }

    return { isAuthenticated: false, needsRefresh: false };
  } catch (error) {
    console.error("Auth check failed:", error);
    return { isAuthenticated: false, needsRefresh: false };
  }
}

/**
 * Clears authentication cookies by making a logout request
 * This ensures cookies are properly cleared on both frontend and backend
 */
export async function clearAuthCookies(): Promise<boolean> {
  try {
    const res = await fetch("https://imba-server.up.railway.app/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    // Clear client-side cookies as fallback
    if (typeof document !== "undefined") {
      document.cookie =
        "accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie =
        "isLoggedIn=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    }

    return res.ok;
  } catch (error) {
    console.error("Failed to clear auth cookies:", error);

    // Still try to clear client-side cookies
    if (typeof document !== "undefined") {
      document.cookie =
        "accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie =
        "isLoggedIn=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    }

    return false;
  }
}

/**
 * Gets the value of a specific cookie
 */
export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);

  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || null;
  }

  return null;
}

/**
 * Checks if the isLoggedIn cookie exists and is set to true
 */
export function hasValidLoginCookie(): boolean {
  const isLoggedIn = getCookie("isLoggedIn");
  return isLoggedIn === "true";
}
