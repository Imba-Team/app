"use client";

/**
 * Sign-in security controls: change password + sign out.
 *
 * Combined into one card so account "security" is a single mental
 * category rather than two disconnected surfaces. The password form
 * validates on the client (matching the server's min length + confirm
 * match); a real password-strength meter belongs behind a stronger
 * server policy, so we don't build it here.
 */

import { useState } from "react";
import { Check, Eye, EyeOff, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useChangePassword } from "@/lib/hooks/useUser";

interface FormState {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const INITIAL: FormState = {
  oldPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function SecurityCard() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [visible, setVisible] = useState({
    old: false,
    new: false,
    confirm: false,
  });
  const [fieldError, setFieldError] = useState<Partial<Record<keyof FormState, string>>>({});
  const [success, setSuccess] = useState(false);
  const { logout } = useAuth();
  const changePassword = useChangePassword();

  const set = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (fieldError[key]) {
      setFieldError((e) => ({ ...e, [key]: undefined }));
    }
    setSuccess(false);
  };

  const toggleVisible = (key: keyof typeof visible) => {
    setVisible((v) => ({ ...v, [key]: !v[key] }));
  };

  const validate = () => {
    const errors: Partial<Record<keyof FormState, string>> = {};
    if (!form.oldPassword) errors.oldPassword = "Current password is required";
    if (!form.newPassword) errors.newPassword = "New password is required";
    else if (form.newPassword.length < 6)
      errors.newPassword = "New password must be at least 6 characters";
    if (form.newPassword && form.newPassword === form.oldPassword)
      errors.newPassword = "New password must be different from current";
    if (form.newPassword !== form.confirmPassword)
      errors.confirmPassword = "Passwords do not match";
    return errors;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validate();
    setFieldError(errors);
    if (Object.keys(errors).length > 0) return;

    setSuccess(false);
    changePassword.mutate(form, {
      onSuccess: () => {
        setSuccess(true);
        setForm(INITIAL);
        setTimeout(() => setSuccess(false), 4000);
      },
      onError: (err) => {
        setFieldError({ oldPassword: (err as Error).message });
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Security</CardTitle>
      </CardHeader>

      <CardContent className="space-y-8">
        {/* Password change */}
        <section>
          <h3 className="text-sm font-semibold text-gray-800 mb-3">
            Change password
          </h3>
          <form onSubmit={submit} className="space-y-3 max-w-md">
            <PasswordField
              id="pw-old"
              label="Current password"
              value={form.oldPassword}
              onChange={(v) => set("oldPassword", v)}
              visible={visible.old}
              onToggleVisible={() => toggleVisible("old")}
              error={fieldError.oldPassword}
              autoComplete="current-password"
            />
            <PasswordField
              id="pw-new"
              label="New password"
              value={form.newPassword}
              onChange={(v) => set("newPassword", v)}
              visible={visible.new}
              onToggleVisible={() => toggleVisible("new")}
              error={fieldError.newPassword}
              autoComplete="new-password"
              hint="At least 6 characters."
            />
            <PasswordField
              id="pw-confirm"
              label="Confirm new password"
              value={form.confirmPassword}
              onChange={(v) => set("confirmPassword", v)}
              visible={visible.confirm}
              onToggleVisible={() => toggleVisible("confirm")}
              error={fieldError.confirmPassword}
              autoComplete="new-password"
            />

            {success && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-emerald-700">
                <Check size={16} />
                <span className="text-sm font-medium">
                  Password updated successfully.
                </span>
              </div>
            )}

            <div className="pt-2">
              <Button
                type="submit"
                disabled={changePassword.isPending}
                className="min-w-40"
              >
                {changePassword.isPending ? "Updating…" : "Update password"}
              </Button>
            </div>
          </form>
        </section>

        {/* Sign out */}
        <section className="border-t border-gray-100 pt-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Sign out</h3>
              <p className="text-xs text-gray-500 mt-1">
                Signs you out of this browser. You&apos;ll need to sign in
                again next time.
              </p>
            </div>
            <Button
              onClick={() => void logout()}
              variant="outline"
              className="whitespace-nowrap"
            >
              <LogOut size={14} className="mr-1" />
              Sign out
            </Button>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggleVisible,
  error,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  error?: string;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-xs font-medium text-gray-500 block mb-1"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={
            "w-full h-10 pl-3 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 text-sm " +
            (error
              ? "border-rose-300 bg-rose-50/40"
              : "border-gray-200")
          }
        />
        <button
          type="button"
          onClick={onToggleVisible}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {(error || hint) && (
        <p
          className={
            "text-xs mt-1 " +
            (error ? "text-rose-600" : "text-gray-400")
          }
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
