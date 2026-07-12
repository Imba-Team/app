import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForgotPassword } from '@/lib/api/hooks/use-auth';
import { ForgotPasswordInput } from '@/lib/utils/schemas';

export function ForgotPasswordForm() {
  const { t } = useTranslation('auth');
  const forgot = useForgotPassword();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(ForgotPasswordInput),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    await forgot.mutateAsync(values).catch(() => undefined);
  });

  if (forgot.isSuccess) {
    return (
      <Alert>
        <AlertTitle>{t('forgot.successTitle')}</AlertTitle>
        <AlertDescription>{t('forgot.successDescription')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t('fields.email')}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder={t('placeholders.email')}
          {...register('email')}
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting || forgot.isPending}>
        {forgot.isPending ? t('actions.sending') : t('actions.sendResetLink')}
      </Button>
    </form>
  );
}
