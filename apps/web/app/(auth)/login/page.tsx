"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import loginImage from "../../../components/images/log.jpeg";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLogin } from "@/lib/hooks/useAuth";
import { AuthApiError } from "@/lib/api/auth";
import { GoogleButton } from "@/components/auth/google-button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";

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

export default function AuthPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, checkAuthentication } = useAuth();

  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  const login = useLogin();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  // Tick every second while locked so the countdown updates.
  useEffect(() => {
    if (lockUntil === null) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [lockUntil]);

  // Clear the lock automatically once the countdown reaches zero.
  useEffect(() => {
    if (lockUntil !== null && now >= lockUntil) {
      setLockUntil(null);
      setError("");
    }
  }, [lockUntil, now]);

  const secondsRemaining =
    lockUntil !== null ? Math.max(0, Math.ceil((lockUntil - now) / 1000)) : 0;
  const isLocked = lockUntil !== null && secondsRemaining > 0;

  const handleSubmit = async (values: LoginFormValues) => {
    if (isLocked) return;
    setError("");

    login.mutate(
      { email: values.email, password: values.password },
      {
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
      }
    );
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden md:block w-1/2 relative">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${loginImage.src})` }}
        ></div>

        <div className="absolute inset-0 mt-18 items-center justify-center ">
          <h1 className="text-white text-4xl md:text-5xl font-bold text-center px-4">
            learn with imba,
            <br /> be imba.
          </h1>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between bg-white px-8 w-full">
        <div className="flex gap-4 mb-8 items-center justify-center pt-10">
          <span className="px-4 py-2 font-semibold text-brand-500 border-b-2 border-brand-500">
            Login
          </span>
          <Link
            href="/register"
            className="px-4 py-2 font-semibold text-gray-500 hover:text-brand-500"
          >
            Sign Up
          </Link>
        </div>

        {/* Middle: form */}
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="w-full max-w-md">
            <h1 className="text-4xl font-bold text-brand-500 mb-8 text-center">
              Welcome back!
            </h1>

            <div className="mb-6">
              <GoogleButton disabled={isLocked} />
            </div>

            <div className="flex items-center gap-3 mb-6" aria-hidden="true">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs uppercase tracking-wide text-gray-400">
                or
              </span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <Form {...form}>
              <form
                className="flex flex-col gap-6"
                onSubmit={form.handleSubmit(handleSubmit)}
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Email"
                          disabled={isLocked}
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            setError("");
                          }}
                          className="pl-4 py-7 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7D5A50] disabled:opacity-60"
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
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Password"
                            disabled={isLocked}
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              setError("");
                            }}
                            className="pl-4 py-7 pr-12 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7D5A50] w-full disabled:opacity-60"
                          />
                          <Button
                            variant={"ghost"}
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2"
                          >
                            {showPassword ? (
                              <EyeOff className="w-5 h-5" />
                            ) : (
                              <Eye className="w-5 h-5" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  variant={"default"}
                  type="submit"
                  disabled={login.isPending || isLocked}
                  className="bg-brand-400 h-12 text-neutral-900 py-4 rounded-xl font-semibold hover:scale-105 transition-transform duration-200 disabled:opacity-60 disabled:hover:scale-100"
                >
                  {isLocked
                    ? `Locked · ${formatDuration(secondsRemaining)}`
                    : login.isPending
                      ? "Logging in..."
                      : "Login"}
                </Button>
              </form>
            </Form>

            {isLocked && (
              <div
                role="alert"
                aria-live="polite"
                className="mt-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
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
              <p className="text-red-500 mt-4 text-center">{error}</p>
            )}
          </div>
        </div>

        {/* Bottom links */}
        <div className="p-6 text-center text-gray-400 text-sm">
          <Link href="/">← Back to Main page</Link>
        </div>
      </div>
    </div>
  );
}
