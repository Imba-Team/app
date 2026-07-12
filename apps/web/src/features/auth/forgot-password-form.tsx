import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForgotPassword } from '@/lib/api/hooks/use-auth';
import { ForgotPasswordInput } from '@/lib/utils/schemas';

export function ForgotPasswordForm() {
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

  // The backend intentionally returns 200 whether or not the address exists
  // (email-enumeration mitigation). We mirror that: always show success.
  if (forgot.isSuccess) {
    return (
      <Alert>
        <AlertTitle>Check your inbox</AlertTitle>
        <AlertDescription>
          If an account exists for that email, we sent a reset link. It expires in 60 minutes.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          {...register('email')}
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting || forgot.isPending}>
        {forgot.isPending ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  );
}
