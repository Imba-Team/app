'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUncollectModule } from '@/lib/hooks/useModules';

// Confirms removing a collected (not owned) module from the library.
// The server keeps the user's progress and pauses the module's reviews,
// so collecting it again picks up where they left off.
export function RemoveFromLibraryDialog({
  moduleId,
  moduleTitle,
  open,
  onOpenChange,
  onRemoved,
}: {
  moduleId: string;
  moduleTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemoved?: () => void;
}) {
  const uncollect = useUncollectModule();

  const confirm = () => {
    uncollect.mutate(moduleId, {
      onSuccess: () => {
        onOpenChange(false);
        onRemoved?.();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove “{moduleTitle}” from your library?</DialogTitle>
          <DialogDescription>
            Its cards will stop appearing in your reviews. Your progress is kept, so if you add it
            again you&apos;ll pick up where you left off.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uncollect.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={uncollect.isPending}>
            {uncollect.isPending ? 'Removing…' : 'Remove'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
