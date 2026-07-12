import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
        <CardTitle className="text-destructive">Delete account</CardTitle>
        <CardDescription>
          Permanently removes your account, sets, and study history. This cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">Delete my account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete account?</DialogTitle>
              <DialogDescription>
                Type your username <span className="font-mono font-medium">{username}</span> to
                confirm. Your account is scheduled for deletion immediately.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="confirm-username">Username</Label>
              <Input
                id="confirm-username"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={username}
                autoComplete="off"
              />
            </div>
            {del.isError && (
              <p className="text-xs text-destructive">
                Deletion failed. Try again or contact support.
              </p>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={onDelete}
                disabled={!canConfirm || del.isPending}
              >
                {del.isPending ? 'Deleting…' : 'Delete permanently'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
