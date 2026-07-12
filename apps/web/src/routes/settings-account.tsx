import { useTranslation } from 'react-i18next';

import { AvatarSection } from '@/features/settings/avatar-section';
import { ChangePasswordSection } from '@/features/settings/change-password-section';
import { DeleteAccountSection } from '@/features/settings/delete-account-section';
import { ProfileSection } from '@/features/settings/profile-section';

export function SettingsAccountRoute() {
  const { t } = useTranslation('auth');
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('settings.description')}</p>
      </header>
      <ProfileSection />
      <AvatarSection />
      <ChangePasswordSection />
      <DeleteAccountSection />
    </div>
  );
}
