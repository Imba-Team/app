import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRegister } from '@/lib/api/hooks/use-auth';
import { RegisterFormInput } from '@/lib/utils/schemas';

export function RegisterForm() {
  const navigate = useNavigate();
  const register = useRegister();

  const {
    register: field,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormInput>({
    resolver: zodResolver(RegisterFormInput),
    defaultValues: {
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
      tos: false as unknown as true,
    },
  });

  const onSubmit = handleSubmit(async ({ email, username, password }) => {
    await register.mutateAsync({ email, username, password }, {
      onSuccess: () => {
        // Backend returns 202 with { email } and sends a verification email.
        // Hand off to a "check your inbox" state on the login page.
        navigate('/login?justRegistered=1', { replace: true });
      },
    });
  });

  const rootError =
    register.error && !register.isPending
      ? ((register.error as { response?: { data?: { message?: string } } }).response?.data?.message ??
        (register.error as Error).message ??
        'Registration failed. Please try again.')
      : null;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          autoComplete="username"
          placeholder="janedoe"
          {...field('username')}
        />
        {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          {...field('email')}
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...field('password')}
        />
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...field('confirmPassword')}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
        )}
      </div>

      <div className="flex items-start gap-2">
        <Controller
          control={control}
          name="tos"
          render={({ field: c }) => (
            <Checkbox
              id="tos"
              checked={c.value === true}
              onCheckedChange={(v) => c.onChange(v === true)}
              className="mt-0.5"
            />
          )}
        />
        <Label htmlFor="tos" className="text-sm font-normal leading-snug">
          I agree to the{' '}
          <a href="/terms" target="_blank" rel="noopener" className="underline">
            Terms
          </a>{' '}
          and{' '}
          <a href="/privacy" target="_blank" rel="noopener" className="underline">
            Privacy Policy
          </a>
          .
        </Label>
      </div>
      {errors.tos && <p className="text-xs text-destructive">{errors.tos.message}</p>}

      {rootError && <p className="text-sm text-destructive">{rootError}</p>}

      <Button type="submit" className="w-full" disabled={isSubmitting || register.isPending}>
        {register.isPending ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  );
}
