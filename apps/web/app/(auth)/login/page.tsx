"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Lock } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useLogin } from "@/lib/hooks/useAuth";
import { AuthApiError } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { GoogleButton } from "@/components/auth/google-button";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordInput } from "@/components/auth/password-input";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, checkAuthentication } = useAuth();
  const login = useLogin();

  const [error, setError] = useState("");
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.push("/dashboard");
  }, [isAuthenticated, isLoading, router]);

  // Tick the countdown while locked.
  useEffect(() => {
    if (lockUntil === null) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [lockUntil]);

  useEffect(() => {
    if (lockUntil !== null && now >= lockUntil) {
      setLockUntil(null);
      setError("");
    }
  }, [lockUntil, now]);

  const secondsRemaining =
    lockUntil !== null ? Math.max(0, Math.ceil((lockUntil - now) / 1000)) : 0;
  const isLocked = lockUntil !== null && secondsRemaining > 0;

  const handleSubmit = (values: LoginFormValues) => {
    if (isLocked) return;
    setError("");
    login.mutate(values, {
      onSuccess: async () => {
        await checkAuthentication();
        router.push("/dashboard");
      },
      onError: (err: Error) => {
        if (err instanceof AuthApiError && err.code === "ACCOUNT_LOCKED") {
          const seconds = err.retryAfterSeconds ?? 0;
          setLockUntil(Date.now() + seconds * 1000);
          setNow(Date.now());
          setError("");
          return;
        }
        setError(err.message);
      },
    });
  };

  return (
    <AuthShell
      switcherHref="/register"
      switcherPrompt="Don't have an account?"
      switcherLabel="Sign up"
      headline={
        <p className="text-2xl md:text-3xl font-bold leading-tight">
          Learn with imba,
          <br />
          be imba.
        </p>
      }
    >
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900">
            Welcome back
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Sign in to keep your streak going.
          </p>
        </div>

        <GoogleButton disabled={isLocked} />

        <div className="my-6 flex items-center gap-3" aria-hidden="true">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs uppercase tracking-wide text-gray-400">
            or
          </span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm text-neutral-700">
                    Email
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      disabled={isLocked}
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        setError("");
                      }}
                      className="h-12 rounded-xl border-gray-300 focus-visible:ring-brand-400 disabled:opacity-60"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm text-neutral-700">
                    Password
                  </FormLabel>
                  <FormControl>
                    <PasswordInput
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        setError("");
                      }}
                      autoComplete="current-password"
                      placeholder="Your password"
                      disabled={isLocked}
                      className="disabled:opacity-60"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isLocked && (
              <div
                role="alert"
                aria-live="polite"
                className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              >
                <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold">Account temporarily locked</p>
                  <p className="mt-1">
                    Too many failed sign-in attempts. Try again in{" "}
                    <span className="font-mono font-semibold">
                      {formatDuration(secondsRemaining)}
                    </span>
                    .
                  </p>
                </div>
              </div>
            )}

            {!isLocked && error && (
              <p role="alert" className="text-sm text-rose-600 -mt-1">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={login.isPending || isLocked}
              className="mt-2 h-12 rounded-xl bg-brand-500 text-white text-base font-semibold hover:bg-brand-500/90 disabled:opacity-60"
            >
              {isLocked
                ? `Locked · ${formatDuration(secondsRemaining)}`
                : login.isPending
                  ? "Signing in…"
                  : "Sign in"}
            </Button>
          </form>
        </Form>
      </div>
    </AuthShell>
  );
}
