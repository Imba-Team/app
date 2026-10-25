"use client";

/**
 * Mirrors the authenticated user's `preferredLanguage` onto
 * `<html lang="...">`. The initial SSR render is always lang="en"
 * (see app/layout.tsx); this component upgrades it on the client
 * once the user data resolves.
 *
 * Runs as a side-effect only — renders nothing.
 */
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMe } from "@/lib/hooks/useUser";

const SUPPORTED = new Set(["en", "ru", "az"]);

export default function HtmlLangSync() {
  const { isAuthenticated } = useAuth();
  // Skip the profile fetch for anonymous visitors — it would only 401.
  const { data: me } = useMe({ enabled: isAuthenticated });

  useEffect(() => {
    const lang = me?.preferredLanguage;
    if (!lang || !SUPPORTED.has(lang)) return;
    if (document.documentElement.lang !== lang) {
      document.documentElement.lang = lang;
    }
  }, [me?.preferredLanguage]);

  return null;
}
