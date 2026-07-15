"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import loginImage from "../../../components/images/log.jpeg";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { useRegister } from "@/lib/hooks/useAuth";
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

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, checkAuthentication } = useAuth();

  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const register = useRegister();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
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

  const handleSubmit = async (values: RegisterFormValues) => {
    setError("");

    register.mutate(
      { name: values.name, email: values.email, password: values.password },
      {
        onSuccess: async () => {
          await checkAuthentication();
          router.push("/dashboard");
        },
        onError: (err: Error) => {
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
            join imba,
            <br /> be imba.
          </h1>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between bg-white px-8 w-full">
        <div className="flex gap-4 mb-8 items-center justify-center pt-10">
          <Link
            href="/login"
            className="px-4 py-2 font-semibold text-gray-500 hover:text-[#4255FF]"
          >
            Login
          </Link>
          <span className="px-4 py-2 font-semibold text-[#4255FF] border-b-2 border-[#4255FF]">
            Sign Up
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center px-6">
          <div className="w-full max-w-md">
            <h1 className="text-4xl font-bold text-[#4255FF] mb-8 text-center">
              Create an Account
            </h1>

            <Form {...form}>
              <form
                className="flex flex-col gap-6"
                onSubmit={form.handleSubmit(handleSubmit)}
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Name"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            setError("");
                          }}
                          className="pl-4 py-7 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7D5A50]"
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
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Email"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            setError("");
                          }}
                          className="pl-4 py-7 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7D5A50]"
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
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              setError("");
                            }}
                            className="pl-4 py-7 pr-12 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7D5A50] w-full"
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
                  disabled={register.isPending}
                  className="bg-[#4255FF] h-12 text-white py-4 rounded-xl font-semibold hover:scale-105 transition-transform duration-200 cl"
                >
                  {register.isPending ? "Signing up..." : "Sign Up"}
                </Button>
              </form>
            </Form>

            {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
          </div>
        </div>

        <div className="p-6 text-center text-gray-400 text-sm">
          <Link href="/">← Back to Main page</Link>
        </div>
      </div>
    </div>
  );
}
