"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { checkAuth, clearAuthCookies } from "@/lib/auth";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  checkAuthentication: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const checkAuthentication = async () => {
    const authStatus = await checkAuth();

    if (authStatus.isAuthenticated) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);

      // If authentication failed and we need to refresh, clear cookies
      if (authStatus.needsRefresh) {
        await clearAuthCookies();
      }
    }

    setIsLoading(false);
  };

  const logout = async () => {
    await clearAuthCookies();
    setIsAuthenticated(false);
    router.push("/login");
  };

  useEffect(() => {
    let mounted = true;

    // Async function to check authentication
    const initAuth = async () => {
      const authStatus = await checkAuth();

      if (!mounted) return;

      if (authStatus.isAuthenticated) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);

        // If authentication failed and we need to refresh, clear cookies
        if (authStatus.needsRefresh) {
          await clearAuthCookies();
        }
      }

      setIsLoading(false);
    };

    initAuth();

    // Set up periodic authentication check (every 5 minutes)
    const interval = setInterval(() => {
      checkAuthentication();
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Check authentication when navigating to protected routes
  useEffect(() => {
    const publicPaths = ["/", "/login", "/register"];
    const isPublicPath = publicPaths.includes(pathname);

    if (!isPublicPath && !isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [pathname, isAuthenticated, isLoading, router]);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, isLoading, checkAuthentication, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
