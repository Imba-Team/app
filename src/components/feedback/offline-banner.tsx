import { WifiOff } from 'lucide-react';

import { useOnline } from '@/lib/hooks/use-online';

/**
 * Small top-of-page banner that appears whenever the browser goes offline.
 * Mounted once inside the authenticated layout so every route inherits it.
 */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive"
    >
      <WifiOff className="size-4" aria-hidden />
      <span>You&apos;re offline — some actions won&apos;t work until you reconnect.</span>
    </div>
  );
}
