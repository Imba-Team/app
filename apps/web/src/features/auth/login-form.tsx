import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLogin } from '@/lib/api/hooks/use-auth';
import { LoginInput } from '@/lib/utils/schemas';

export function LoginForm() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginInput),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    await login.mutateAsync(values, {
      onSuccess: () => {
        const from = (location.state as { from?: string } | null)?.from ?? '/';
        navigate(from, { replace: true });
      },
    });
  });

  const rootError =
    login.error && !login.isPending
      ? ((login.error as { response?: { data?: { message?: string } } }).response?.data?.message ??
        (login.error as Error).message ??
        t('login.failed'))
      : null;

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

      <div className="space-y-2">
        <Label htmlFor="password">{t('fields.password')}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
        />
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>

      {rootError && <p className="text-sm text-destructive">{rootError}</p>}

      <Button type="submit" className="w-full" disabled={isSubmitting || login.isPending}>
        {login.isPending ? t('actions.signingIn') : t('actions.signIn')}
      </Button>
    </form>
  );
}
