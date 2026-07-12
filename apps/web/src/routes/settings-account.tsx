import { AvatarSection } from '@/features/settings/avatar-section';
import { ChangePasswordSection } from '@/features/settings/change-password-section';
import { DeleteAccountSection } from '@/features/settings/delete-account-section';
import { ProfileSection } from '@/features/settings/profile-section';

export function SettingsAccountRoute() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Account</h1>
        <p className="text-muted-foreground">Manage your profile, password, and account state.</p>
      </header>
      <ProfileSection />
      <AvatarSection />
      <ChangePasswordSection />
      <DeleteAccountSection />
    </div>
  );
}
