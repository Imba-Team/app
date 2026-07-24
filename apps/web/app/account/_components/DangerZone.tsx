"use client";

/**
 * Account deletion. Requires typing the sentinel to confirm — a small
 * amount of friction that turns "oops I clicked" into a deliberate act.
 *
 * On success we blow away client-side session state and hard-redirect
 * to /. HttpOnly cookies get cleared by /auth/logout server-side; the
 * hint cookie is cleared in lib/auth.clearAuthCookies.
 */

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clearAuthCookies } from "@/lib/auth";
import { useDeleteMe } from "@/lib/hooks/useUser";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SENTINEL = "DELETE MY ACCOUNT";

export default function DangerZone() {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const deleteMe = useDeleteMe();

  const canSubmit =
    confirmText.trim().toUpperCase() === SENTINEL && !deleteMe.isPending;

  const handleDelete = async () => {
    if (!canSubmit) return;
    deleteMe.mutate(undefined, {
      onSuccess: async () => {
        await clearAuthCookies();
        window.location.href = "/";
      },
      onError: (err) => {
        toast.error((err as Error).message || "Failed to delete account");
      },
    });
  };

  return (
    <Card className="border-rose-200">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-rose-600" />
          <CardTitle className="text-xl text-rose-700">Danger zone</CardTitle>
        </div>
      </CardHeader>

      <CardContent>
        {!confirming ? (
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="font-semibold text-gray-800">Delete account</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-md">
                Permanently deletes your account, modules, sessions, and
                mastery data. This cannot be undone.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setConfirming(true)}
              className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 whitespace-nowrap"
            >
              Delete account
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-4 space-y-3">
            <div>
              <h4 className="font-semibold text-rose-800">
                Are you absolutely sure?
              </h4>
              <p className="text-sm text-gray-700 mt-1">
                This will permanently delete your account and all associated
                data.
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-700 block mb-1">
                Type{" "}
                <span className="font-mono font-semibold text-rose-800">
                  {SENTINEL}
                </span>{" "}
                to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={SENTINEL}
                autoComplete="off"
                spellCheck={false}
                className={cn(
                  "w-full h-10 px-3 border rounded-lg text-sm focus:outline-none focus:ring-2",
                  "border-rose-200 focus:ring-rose-300 focus:border-rose-400",
                )}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setConfirming(false);
                  setConfirmText("");
                }}
                disabled={deleteMe.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                disabled={!canSubmit}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {deleteMe.isPending ? "Deleting…" : "Delete my account"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
