import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../cn';

const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-brand-ink shadow-sm hover:bg-brand-hover',
        secondary: 'border border-brand bg-surface text-brand hover:bg-brand-tint',
        ghost: 'text-ink hover:bg-surface-2',
        danger: 'bg-danger text-white shadow-sm hover:brightness-95',
        subtle: 'bg-brand-soft text-brand-deep hover:bg-brand-tint',
      },
      size: {
        sm: 'min-h-9 px-3 text-sm',
        md: 'min-h-11 px-4 text-base',
        lg: 'min-h-[52px] px-6 text-base',
        icon: 'size-11 p-0',
      },
      block: {
        true: 'w-full',
        /** Full width on phone, natural width from md up (patient CTAs). */
        phone: 'w-full md:w-auto',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild, loading, disabled, children, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size, block }), className);
    if (asChild) {
      // Radix Slot needs exactly one child element — no spinner slot alongside it.
      return (
        <Slot ref={ref} className={classes} {...props}>
          {children}
        </Slot>
      );
    }
    return (
      <button ref={ref} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
        {loading ? <Spinner /> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden className={cn('inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)} />;
}

export { buttonVariants };
