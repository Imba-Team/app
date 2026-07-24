"use client";

/**
 * Combined view + inline edit for the account owner's profile.
 *
 * The server's `PATCH /users/me` accepts only `{ name?, bio? }` — email
 * and status changes are deliberately excluded to avoid the
 * privilege-escalation shape flagged in the Sprint 3 audit. So this
 * component intentionally renders email + username as read-only, and
 * only puts name + bio behind inputs when editing.
 */

import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { buildAssetUrl } from "@/lib/env";
import {
  useUpdateMe,
  useUpdateProfilePicture,
  type User,
} from "@/lib/hooks/useUser";

interface ProfileCardProps {
  user: User;
}

function formatMemberSince(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function ProfileCard({ user }: ProfileCardProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio ?? "");
  const nameRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateMe = useUpdateMe();
  const updatePicture = useUpdateProfilePicture();
  const uploading = updatePicture.isPending;
  const saving = updateMe.isPending;

  // Reset form to canonical values whenever the user record refreshes
  // (e.g. after a successful save).
  useEffect(() => {
    if (!editing) {
      setName(user.name);
      setBio(user.bio ?? "");
    }
  }, [editing, user.name, user.bio]);

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => nameRef.current?.focus());
    }
  }, [editing]);

  const startEdit = () => {
    setName(user.name);
    setBio(user.bio ?? "");
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setName(user.name);
    setBio(user.bio ?? "");
  };

  const save = () => {
    const trimmedName = name.trim();
    const trimmedBio = bio.trim();
    if (!trimmedName) return;

    // Only send fields the user actually changed. `PATCH /users/me`
    // treats absent fields as "leave alone", so a no-op call still
    // works but is wasteful.
    const payload: { name?: string; bio?: string } = {};
    if (trimmedName !== user.name) payload.name = trimmedName;
    if (trimmedBio !== (user.bio ?? "")) payload.bio = trimmedBio;

    if (Object.keys(payload).length === 0) {
      setEditing(false);
      return;
    }

    updateMe.mutate(payload, {
      onSuccess: () => setEditing(false),
    });
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    updatePicture.mutate(file);
    // Reset the input value so re-selecting the same file re-fires change.
    e.target.value = "";
  };

  const initials = (user.name ?? user.username ?? "?")
    .split(/\s+/)
    .map((s) => s.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl">Profile</CardTitle>
        {editing ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={cancel}
              disabled={saving}
            >
              <X size={14} className="mr-1" /> Cancel
            </Button>
            <Button
              size="sm"
              onClick={save}
              disabled={saving || !name.trim()}
              className="min-w-20"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="mr-1 animate-spin" /> Saving
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={startEdit}>
            <Pencil size={14} className="mr-1" /> Edit
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Avatar + name row */}
        <div className="flex items-start gap-5">
          <div className="relative group shrink-0">
            <Avatar className="size-20 border border-gray-200">
              <AvatarImage
                src={
                  user.profilePicture
                    ? buildAssetUrl(user.profilePicture)
                    : undefined
                }
                alt={user.name}
                crossOrigin="anonymous"
                className="object-cover"
              />
              <AvatarFallback className="text-xl">{initials}</AvatarFallback>
            </Avatar>

            <input
              ref={fileInputRef}
              id="profile-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-label={uploading ? "Uploading avatar" : "Change avatar"}
              className={cn(
                "absolute -bottom-1 -right-1 size-8 rounded-full bg-white border border-gray-200 shadow-sm",
                "flex items-center justify-center text-gray-600",
                "hover:text-[#4255FF] hover:border-[#4255FF] transition-colors",
                uploading && "cursor-wait",
              )}
            >
              {uploading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Camera size={14} />
              )}
            </button>
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="profile-name"
                    className="text-xs font-medium text-gray-500 block mb-1"
                  >
                    Display name
                  </label>
                  <input
                    ref={nameRef}
                    id="profile-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={50}
                    placeholder="Your name"
                    disabled={saving}
                    className="w-full h-10 px-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4255FF]/40 focus:border-[#4255FF] disabled:bg-gray-50 text-base"
                  />
                </div>
                <div>
                  <label
                    htmlFor="profile-bio"
                    className="text-xs font-medium text-gray-500 block mb-1"
                  >
                    Bio
                    <span className="text-gray-400 ml-1 font-normal">
                      · {bio.length}/280
                    </span>
                  </label>
                  <textarea
                    id="profile-bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={280}
                    rows={3}
                    placeholder="Vocabulary nerd. Always learning."
                    disabled={saving}
                    className="w-full min-h-20 px-3 py-2 border border-gray-200 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-[#4255FF]/40 focus:border-[#4255FF] disabled:bg-gray-50 text-sm leading-relaxed"
                  />
                </div>
              </div>
            ) : (
              <>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 leading-tight">
                    {user.name}
                  </h2>
                  <p className="text-sm text-gray-500">@{user.username}</p>
                </div>
                {user.bio ? (
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                    {user.bio}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 italic">
                    No bio yet. Add one to tell people what you&apos;re
                    learning.
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Read-only account fields */}
        <div className="border-t border-gray-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <ReadOnlyField label="Email">
            <span className="flex items-center gap-2">
              <span className="text-gray-800 truncate">{user.email}</span>
              {user.emailVerified ? (
                <span className="inline-flex items-center gap-1 text-xs rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 px-2 py-0.5">
                  <CheckCircle2 size={12} /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center text-xs rounded-full border border-amber-200 bg-amber-50 text-amber-700 px-2 py-0.5">
                  Not verified
                </span>
              )}
            </span>
            <p className="text-xs text-gray-400 mt-1">
              To change your email, contact support.
            </p>
          </ReadOnlyField>

          <ReadOnlyField label="Member since">
            <span className="text-gray-800">
              {formatMemberSince(user.createdAt)}
            </span>
          </ReadOnlyField>
        </div>

      </CardContent>
    </Card>
  );
}

function ReadOnlyField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <div>{children}</div>
    </div>
  );
}
