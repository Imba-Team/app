"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function GoogleCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { checkAuthentication } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ok = searchParams.get("ok");

    if (ok !== "1") {
      setError("Google sign-in was cancelled or failed. Please try again.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await checkAuthentication();
        if (!cancelled) router.replace("/dashboard");
      } catch {
        if (!cancelled) {
          setError(
            "We couldn't complete your Google sign-in. Please try again.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [checkAuthentication, router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="max-w-md w-full text-center">
        {error ? (
          <>
            <h1 className="text-2xl font-bold text-brand-500 mb-3">
              Sign-in failed
            </h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link
              href="/login"
              className="inline-block px-6 py-3 rounded-xl bg-brand-400 text-neutral-900 font-semibold hover:scale-105 transition-transform duration-200"
            >
              Back to login
            </Link>
          </>
        ) : (
          <>
            <div
              className="mx-auto mb-6 h-10 w-10 rounded-full border-4 border-brand-400 border-t-transparent animate-spin"
              aria-hidden="true"
            />
            <p className="text-gray-600">Signing you in…</p>
          </>
        )}
      </div>
    </div>
  );
}
