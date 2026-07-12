import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface StatusScreenProps {
  /** Small eyebrow label above the title, e.g. "404" or "Offline". */
  label?: string | undefined;
  title: string;
  description?: string | undefined;
  icon?: LucideIcon | undefined;
  /** Rendered below the description. Typically one or two `<Button>`s. */
  action?: ReactNode | undefined;
  className?: string | undefined;
}

/**
 * Centered feedback layout shared by every full-screen empty / error /
 * not-found / permission-denied surface. Keeps them visually consistent
 * without proliferating near-identical flex containers.
 */
export function StatusScreen({
  label,
  title,
  description,
  icon: Icon,
  action,
  className,
}: StatusScreenProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center',
        className,
      )}
    >
      {Icon && <Icon className="size-12 text-muted-foreground" aria-hidden />}
      {label && <p className="text-sm font-medium text-muted-foreground">{label}</p>}
      <h1 className="text-3xl font-semibold">{title}</h1>
      {description && <p className="max-w-md text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}
