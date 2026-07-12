import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/api/hooks/auth-context';
import { useUpdateAvatar } from '@/lib/api/hooks/use-me';

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export function AvatarSection() {
  const { t } = useTranslation('auth');
  const { currentUser } = useAuth();
  const upload = useUpdateAvatar();
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const initials = currentUser?.name?.slice(0, 2).toUpperCase() ?? '?';

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setLocalError(t('settings.avatar.tooLarge'));
      return;
    }
    if (!file.type.startsWith('image/')) {
      setLocalError(t('settings.avatar.onlyImages'));
      return;
    }
    await upload.mutateAsync(file).catch(() => undefined);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.avatar.title')}</CardTitle>
        <CardDescription>{t('settings.avatar.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <Avatar className="size-16">
          {currentUser?.profilePicture && (
            <AvatarImage src={currentUser.profilePicture} alt={currentUser.name} />
          )}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFile}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
          >
            {upload.isPending ? t('settings.avatar.uploading') : t('settings.avatar.change')}
          </Button>
          {localError && <p className="text-xs text-destructive">{localError}</p>}
          {upload.isError && !localError && (
            <p className="text-xs text-destructive">{t('settings.avatar.uploadFailed')}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
