import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/api/hooks/auth-context';
import { useDeleteMyAccount } from '@/lib/api/hooks/use-me';

export function DeleteAccountSection() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const del = useDeleteMyAccount();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');

  const username = currentUser?.username ?? '';
  const canConfirm = typed === username && username.length > 0;

  const onDelete = async () => {
    await del.mutateAsync(undefined, {
      onSuccess: () => {
        setOpen(false);
        navigate('/login', { replace: true });
      },
    });
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">{t('settings.delete.title')}</CardTitle>
        <CardDescription>{t('settings.delete.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">{t('settings.delete.button')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('settings.delete.dialogTitle')}</DialogTitle>
              <DialogDescription>
                {t('settings.delete.dialogDescription', { username })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="confirm-username">{t('fields.username')}</Label>
              <Input
                id="confirm-username"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={username}
                autoComplete="off"
              />
            </div>
            {del.isError && (
              <p className="text-xs text-destructive">{t('settings.delete.failed')}</p>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {t('settings.delete.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={onDelete}
                disabled={!canConfirm || del.isPending}
              >
                {del.isPending
                  ? t('settings.delete.deleting')
                  : t('settings.delete.deleteButton')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
