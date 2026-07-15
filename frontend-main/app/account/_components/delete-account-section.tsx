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
import { Input } from "@/components/ui/input";
import { AlertTriangle } from "lucide-react";
import { clearAuthCookies } from "@/lib/auth";
import { useDeleteMe } from "@/lib/hooks/useUser";
import { toast } from "sonner";

export default function DeleteAccountSection() {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const deleteMe = useDeleteMe();

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText !== "DELETE MY ACCOUNT") return;
    setIsLoading(true);

    deleteMe.mutate(undefined, {
      onSuccess: async () => {
        await clearAuthCookies();
        window.location.href = "/";
      },
      onError: () => {
        toast.error("Failed to delete account");
        setIsLoading(false);
      },
    });
  };

  return (
    <Card className="border-destructive/50 shadow-lg overflow-hidden">
      <div className="bg-destructive/5 -m-6 p-6 mb-0">
        <CardHeader className="p-0">
          <div className="flex items-center gap-3 ml-6">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <CardTitle className="text-destructive text-2xl">
                Danger Zone
              </CardTitle>
              <CardDescription>Irreversible actions</CardDescription>
            </div>
          </div>
        </CardHeader>
      </div>
      <CardContent className="pt-8 pb-8">
        {!showDeleteConfirm ? (
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-foreground">Delete Account</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Permanently delete your account and all associated data. This
                action cannot be undone.
              </p>
            </div>
            <Button
              onClick={() => setShowDeleteConfirm(true)}
              variant="destructive"
              className="whitespace-nowrap"
            >
              Delete Account
            </Button>
          </div>
        ) : (
          <div className="space-y-4 rounded-lg border border-destructive/20 bg-destructive/5 p-6">
            <div>
              <h4 className="font-semibold text-destructive">
                Are you absolutely sure?
              </h4>
              <p className="mt-2 text-sm text-foreground">
                This will permanently delete your account and all your data.
                This action cannot be reversed.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">
                Type <span className="font-bold">DELETE MY ACCOUNT</span> to
                confirm:
              </label>
              <Input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
                className="mt-2 border-destructive/30 focus:border-destructive"
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleDeleteAccount}
                disabled={confirmText !== "DELETE MY ACCOUNT" || isLoading}
                variant="destructive"
              >
                {isLoading ? "Deleting..." : "Yes, Delete My Account"}
              </Button>
              <Button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setConfirmText("");
                }}
                variant="outline"
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
