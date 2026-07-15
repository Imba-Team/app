"use client";

import { useEffect, useState } from "react";
import ProfileSection from "@/app/account/_components/profile-section";
import EditProfileForm from "@/app/account/_components/edit-profile-form";
import PasswordChangeForm from "@/app/account/_components/password-change-form";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useMe } from "@/lib/hooks/useUser";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default function AccountPage() {
  const { data: me, isLoading: meLoading } = useMe();
  const [isEditing, setIsEditing] = useState(false);
  const router = useRouter();
  const { logout } = useAuth();
  useEffect(() => {
    if (!meLoading && !me) {
      router.push("/login");
    }
  }, [meLoading, router, me]);

  if (meLoading) return <p className="p-8">loading…</p>;
  if (!me) return null;

  return (
    <>
      <main className="min-h-screen bg-linear-to-br from-background to-secondary/20 py-8 px-4">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-[#4255ff]">
                Account Settings
              </h1>
              <p className="mt-2 text-muted-foreground">
                Manage your account information and preferences
              </p>
            </div>

            <Button
              onClick={logout}
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>

          <div className="space-y-6">
            {!isEditing
              ? me && (
                  <ProfileSection
                    userData={me}
                    isEditing={isEditing}
                    setIsEditing={setIsEditing}
                  />
                )
              : me && (
                  <EditProfileForm
                    userData={me}
                    onCancel={() => setIsEditing(false)}
                    onSuccess={() => setIsEditing(false)}
                  />
                )}

            <PasswordChangeForm />
          </div>
        </div>
      </main>
    </>
  );
}
