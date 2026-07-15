"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Edit2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiClient } from "@/lib/axios";
import { toast } from "sonner";
import { User } from "@/lib/hooks/useUser";

interface ProfileSectionProps {
  userData: User;
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
}

export default function ProfileSection({
  userData,
  isEditing,
  setIsEditing,
}: ProfileSectionProps) {
  const [uploading, setUploading] = useState(false);

  if (isEditing) return null;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      await apiClient.patch("/users/me/profile-picture", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Profile picture updated");
      window.location.reload();
    } catch (error) {
      console.error("upload error:", error);
      toast.error("Failed to upload profile picture");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <div className="bg-linear-to-r from-[#4255ff]/5 to-accent/5 -m-6 p-6 mb-0">
        <CardHeader className="p-0">
          <div className="flex items-center justify-between">
            <div className="ml-6">
              <CardTitle className="text-2xl">Profile Information</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </div>
            <Button
              onClick={() => setIsEditing(true)}
              variant="outline"
              size="sm"
              className="gap-2 mr-6"
            >
              <Edit2 className="h-4 w-4" />
              Edit
            </Button>
          </div>
        </CardHeader>
      </div>

      <CardContent className="pt-8 pb-8">
        <div className="flex flex-col items-center mb-8">
          <Avatar className="h-28 w-28 border border-gray-200">
            <AvatarImage
              src={
                userData.profilePicture
                  ? "https://imba-server.up.railway.app" +
                    userData.profilePicture
                  : undefined
              }
              alt={userData.name}
              crossOrigin="anonymous"
              className="object-cover"
            />
            <AvatarFallback className="text-3xl">
              {userData.name.charAt(0).toUpperCase() +
                userData.name.charAt(1).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <input
            id="profile-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />

          <Button variant="secondary" size="sm" asChild className="mt-4">
            <label htmlFor="profile-upload" className="cursor-pointer">
              {uploading ? "Uploading..." : "Change photo"}
            </label>
          </Button>
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Name</p>
            <p className="text-lg font-semibold text-foreground">
              {userData.name}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Email</p>
            <p className="text-lg font-semibold text-foreground">
              {userData.email}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Status</p>
            <Badge className="w-fit bg-[#4255ff] text-primary-foreground">
              {userData.status}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
