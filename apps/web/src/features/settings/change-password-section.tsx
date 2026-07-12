import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useChangePassword } from '@/lib/api/hooks/use-me';
import { ChangePasswordFormInput } from '@/lib/utils/schemas';

export function ChangePasswordSection() {
  const change = useChangePassword();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormInput>({
    resolver: zodResolver(ChangePasswordFormInput),
    defaultValues: { oldPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    await change.mutateAsync(values, { onSuccess: () => reset() });
  });

  const rootError =
    change.error && !change.isPending
      ? ((change.error as { response?: { data?: { message?: string } } }).response?.data?.message ??
        'Password change failed.')
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>You'll stay signed in on this device.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="oldPassword">Current password</Label>
            <Input
              id="oldPassword"
              type="password"
              autoComplete="current-password"
              {...register('oldPassword')}
            />
            {errors.oldPassword && (
              <p className="text-xs text-destructive">{errors.oldPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              {...register('newPassword')}
            />
            {errors.newPassword && (
              <p className="text-xs text-destructive">{errors.newPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
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
          {change.isSuccess && (
            <Alert>
              <AlertTitle>Password updated</AlertTitle>
              <AlertDescription>Use the new password on your next sign-in.</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={isSubmitting || change.isPending}>
            {change.isPending ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
