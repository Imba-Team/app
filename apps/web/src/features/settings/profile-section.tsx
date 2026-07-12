import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/api/hooks/auth-context';
import { useUpdateMyProfile } from '@/lib/api/hooks/use-me';
import { UpdateProfileInput } from '@/lib/utils/schemas';

export function ProfileSection() {
  const { t } = useTranslation('auth');
  const { currentUser } = useAuth();
  const update = useUpdateMyProfile();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(UpdateProfileInput),
    defaultValues: {
      name: currentUser?.name ?? '',
      bio: currentUser?.bio ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const payload: { name: string; bio?: string } = { name: values.name };
    if (values.bio) payload.bio = values.bio;
    const user = await update.mutateAsync(payload);
    reset({ name: user.name, bio: user.bio ?? '' });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.profile.title')}</CardTitle>
        <CardDescription>{t('settings.profile.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('fields.name')}</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">{t('fields.bio')}</Label>
            <Textarea id="bio" rows={3} maxLength={280} {...register('bio')} />
            {errors.bio && <p className="text-xs text-destructive">{errors.bio.message}</p>}
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isSubmitting || update.isPending || !isDirty}>
              {update.isPending ? t('settings.profile.saving') : t('settings.profile.save')}
            </Button>
            {update.isSuccess && !isDirty && (
              <span className="text-xs text-muted-foreground">{t('settings.profile.saved')}</span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
