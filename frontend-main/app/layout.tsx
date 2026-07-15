"use client";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import { usePathname } from "next/navigation";
import { AuthProvider } from "@/contexts/AuthContext";
import { QueryProvider } from "@/lib/providers/QueryProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isAuthPage =
    pathname.includes("/login") || pathname.includes("/register");

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider>
          <AuthProvider>
            {!isAuthPage && <Header />}
            {children}

            {!isAuthPage && (
              <footer className="fixed w-full py-4 bottom-0 text-center text-sm text-gray-600 bg-white border-t">
                <p>
                  &copy; {new Date().getFullYear()} Imba Learn. All rights
                  reserved.
                </p>
              </footer>
            )}
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
