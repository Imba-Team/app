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
import { useMe } from "@/lib/hooks/useUser";

const SUPPORTED = new Set(["en", "ru", "az"]);

export default function HtmlLangSync() {
  const { data: me } = useMe();

  useEffect(() => {
    const lang = me?.preferredLanguage;
    if (!lang || !SUPPORTED.has(lang)) return;
    if (document.documentElement.lang !== lang) {
      document.documentElement.lang = lang;
    }
  }, [me?.preferredLanguage]);

  return null;
}
