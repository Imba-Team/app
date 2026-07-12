import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useResetPassword } from '@/lib/api/hooks/use-auth';
import { ResetPasswordFormInput } from '@/lib/utils/schemas';

export function ResetPasswordForm({ token }: { token: string }) {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const reset = useResetPassword();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormInput>({
    resolver: zodResolver(ResetPasswordFormInput),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ password, confirmPassword }) => {
    await reset.mutateAsync(
      { token, password, confirmPassword },
      {
        onSuccess: () => {
          setTimeout(() => navigate('/login', { replace: true }), 1500);
        },
      },
    );
  });

  const rootError =
    reset.error && !reset.isPending
      ? ((reset.error as { response?: { data?: { message?: string } } }).response?.data?.message ??
        (reset.error as Error).message ??
        t('reset.failed'))
      : null;

  if (reset.isSuccess) {
    return (
      <Alert>
        <AlertTitle>{t('reset.successTitle')}</AlertTitle>
        <AlertDescription>{t('reset.successDescription')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">{t('fields.newPassword')}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register('password')}
        />
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t('fields.confirmNewPassword')}</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
        )}
      </div>

      {rootError && <p className="text-sm text-destructive">{rootError}</p>}

      <Button type="submit" className="w-full" disabled={isSubmitting || reset.isPending}>
        {reset.isPending ? t('actions.updating') : t('actions.updatePassword')}
      </Button>
    </form>
  );
}
