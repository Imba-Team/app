'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { CreateModuleDialog } from '@/components/CreateModuleDialog';

interface OpenOptions {
  /** Pre-select this folder in the "Folder" dropdown. */
  folderId?: string;
}

interface CreateModuleDialogContextValue {
  open: (options?: OpenOptions) => void;
  close: () => void;
}

const CreateModuleDialogContext = createContext<CreateModuleDialogContextValue | null>(null);

export function useCreateModuleDialog() {
  const ctx = useContext(CreateModuleDialogContext);
  if (!ctx) {
    throw new Error('useCreateModuleDialog must be used inside <CreateModuleDialogProvider>');
  }
  return ctx;
}

interface DialogState {
  open: boolean;
  /**
   * Bumped every time `open()` is called. Used as a `key` on the dialog
   * so it remounts fresh — a cancelled draft never leaks into the next
   * session, and we avoid setState-in-effect resets.
   */
  instanceId: number;
  defaultFolderId?: string;
}

export function CreateModuleDialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState>({
    open: false,
    instanceId: 0,
  });

  const openDialog = useCallback((options?: OpenOptions) => {
    setState((prev) => ({
      open: true,
      instanceId: prev.instanceId + 1,
      defaultFolderId: options?.folderId,
    }));
  }, []);

  const closeDialog = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    setState((prev) => ({ ...prev, open: next }));
  }, []);

  const value = useMemo(
    () => ({ open: openDialog, close: closeDialog }),
    [openDialog, closeDialog],
  );

  return (
    <CreateModuleDialogContext.Provider value={value}>
      {children}
      <CreateModuleDialog
        key={state.instanceId}
        open={state.open}
        onOpenChange={handleOpenChange}
        defaultFolderId={state.defaultFolderId}
      />
    </CreateModuleDialogContext.Provider>
  );
}
