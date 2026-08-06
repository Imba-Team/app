"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { useAuth } from "@/contexts/AuthContext";
import { useRegister } from "@/lib/hooks/useAuth";
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

const registerSchema = z.object({
  username: z.string().min(2, "Username must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, checkAuthentication } = useAuth();
  const register = useRegister();

  const [error, setError] = useState("");

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", email: "", password: "" },
  });

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.push("/dashboard");
  }, [isAuthenticated, isLoading, router]);

  const handleSubmit = (values: RegisterFormValues) => {
    setError("");
    register.mutate(values, {
      onSuccess: async () => {
        await checkAuthentication();
        router.push("/dashboard");
      },
      onError: (err: Error) => setError(err.message),
    });
  };

  return (
    <AuthShell
      switcherHref="/login"
      switcherPrompt="Already have an account?"
      switcherLabel="Log in"
      headline={
        <p className="text-2xl md:text-3xl font-bold leading-tight">
          Join imba,
          <br />
          be imba.
        </p>
      }
    >
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900">
            Create an account
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Start learning with spaced repetition. It takes less than a minute.
          </p>
        </div>

        <GoogleButton label="Sign up with Google" />

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
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm text-neutral-700">
                    Username
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="yourname"
                      autoComplete="username"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        setError("");
                      }}
                      className="h-12 rounded-xl border-gray-300 focus-visible:ring-brand-400"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        setError("");
                      }}
                      className="h-12 rounded-xl border-gray-300 focus-visible:ring-brand-400"
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
                      autoComplete="new-password"
                      placeholder="At least 6 characters"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && (
              <p role="alert" className="text-sm text-rose-600 -mt-1">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={register.isPending}
              className="mt-2 h-12 rounded-xl bg-brand-500 text-white text-base font-semibold hover:bg-brand-500/90 disabled:opacity-60"
            >
              {register.isPending ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </Form>
      </div>
    </AuthShell>
  );
}
