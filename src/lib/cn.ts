import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge classNames intelligently — clsx conditional handling + tailwind-merge conflict resolution.
 * Every shadcn component uses this via `import { cn } from '@/lib/cn'`.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
