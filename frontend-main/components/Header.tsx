"use client";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "./ui/skeleton";
import { useMe } from "@/lib/hooks/useUser";

export default function Header() {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const { data: me } = useMe();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="bg-white border-b border-gray-200 text-[#4255FF] shadow-sm p-4 flex items-center justify-between">
      <Link href="/">
        <h1 className="text-2xl font-bold ml-4">Imba Learn</h1>
      </Link>

      {isAuthenticated ? (
        <div className="flex items-center gap-3 mr-4">
          <Link
            href="/account"
            className="flex items-center gap-3 hover:opacity-80 transition"
          >
            {isLoading ? (
              <Skeleton className="size-12 rounded-full bg-gray-200" />
            ) : (
              <Avatar className="size-12 border border-gray-100">
                <AvatarImage
                  src={
                    "https://imba-server.up.railway.app" + me?.profilePicture
                  }
                  alt={me?.name}
                  crossOrigin="anonymous"
                />
                <AvatarFallback>
                  {me ? getInitials(me.name) : "U"}
                </AvatarFallback>
              </Avatar>
            )}
          </Link>

          {isLoading ? (
            <Skeleton className="size-8 rounded-md bg-gray-200" />
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="hover:bg-red-50 hover:text-red-600"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          )}
        </div>
      ) : (
        <div>
          <Button asChild variant="ghost" className="mr-4" size={"sm"}>
            <Link href="/login">Login</Link>
          </Button>
          <Button asChild className="mr-4" size={"sm"}>
            <Link href="/register">Sign Up</Link>
          </Button>
        </div>
      )}
    </header>
  );
}
