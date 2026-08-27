import * as React from 'react';

import { cn } from '@/lib/utils';

type InputProps = React.ComponentProps<'input'> & {
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
};

const inputBase =
  'h-11 w-full min-w-0 rounded-full border border-black/5 bg-white text-sm text-neutral-900 placeholder:text-neutral-500 placeholder:text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-black/20 disabled:cursor-not-allowed disabled:opacity-50 file:inline-flex file:h-9 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-neutral-800';

function Input({ className, type, startIcon, endIcon, ...props }: InputProps) {
  const paddingClass = cn(startIcon ? 'pl-11' : 'pl-4', endIcon ? 'pr-11' : 'pr-4');

  if (!startIcon && !endIcon) {
    return (
      <input
        type={type}
        data-slot="input"
        className={cn(inputBase, paddingClass, className)}
        {...props}
      />
    );
  }

  return (
    <div className="relative w-full">
      {startIcon && (
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-neutral-500 [&>svg]:size-4">
          {startIcon}
        </span>
      )}
      <input
        type={type}
        data-slot="input"
        className={cn(inputBase, paddingClass, className)}
        {...props}
      />
      {endIcon && (
        <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-neutral-500 [&>svg]:size-4">
          {endIcon}
        </span>
      )}
    </div>
  );
}

export { Input };
