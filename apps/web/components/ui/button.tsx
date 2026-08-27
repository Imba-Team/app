import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-colors outline-none cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-black/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 shrink-0",
  {
    variants: {
      variant: {
        default: 'bg-brand-300 text-neutral-900 hover:bg-brand-400',
        secondary: 'bg-white text-neutral-800 border border-black/5 hover:bg-black/5',
        ghost: 'text-neutral-800 hover:bg-black/5',
        outline: 'border border-black/10 bg-transparent text-neutral-800 hover:bg-black/5',
        destructive: 'bg-rose-500 text-white hover:bg-rose-600 focus-visible:ring-rose-500/30',
        link: 'text-neutral-900 underline-offset-4 hover:underline rounded-none px-0',
        // navbar: 'bg-white text-neutral-800 hover:bg-black/5',
        navbar: cn(
          'relative isolate overflow-hidden bg-white text-neutral-800',
          // the sweeping fill
          'before:absolute before:inset-0 before:-z-10 before:origin-left before:scale-x-0 before:rounded-full before:bg-black/5 before:transition-transform before:duration-200 before:ease-out',
          'hover:before:scale-x-100',
        ),
      },
      size: {
        default: cn('h-11 px-4'),
        sm: 'h-9 px-4 text-sm',
        lg: 'h-12 px-6',
        icon: 'size-11',
        'icon-sm': 'size-9',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return (
    <div className={cn(variant == 'navbar' && 'bg-white rounded-full p-1 border border-black/5')}>
      <Comp
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    </div>
  );
}

export { Button, buttonVariants };
