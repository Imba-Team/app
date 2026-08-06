"use client";

import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/env";

interface GoogleButtonProps {
  label?: string;
  disabled?: boolean;
}

export function GoogleButton({
  label = "Continue with Google",
  disabled = false,
}: GoogleButtonProps) {
  const handleClick = () => {
    if (disabled) return;
    // Full navigation: the browser must follow the backend → Google →
    // backend callback redirect chain, so we can't use fetch here.
    window.location.href = `${API_BASE_URL}/auth/google`;
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={disabled}
      className="w-full h-12 flex items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white text-neutral-900 font-semibold hover:bg-gray-50 disabled:opacity-60"
    >
      <GoogleIcon className="h-5 w-5" />
      <span>{label}</span>
    </Button>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44a5.51 5.51 0 0 1-2.39 3.62v3h3.86c2.26-2.09 3.58-5.17 3.58-8.86z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.94-2.91l-3.86-3c-1.07.72-2.44 1.16-4.08 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.997 11.997 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.19 7.19 0 0 1 4.89 12c0-.79.14-1.56.38-2.29V6.62H1.29A11.997 11.997 0 0 0 0 12c0 1.94.46 3.78 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}
