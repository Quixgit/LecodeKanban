import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
  [
    'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium',
    'transition-[background-color,border-color,color,box-shadow,transform] duration-micro ease-out',
    'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-100',
    '[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-primary-solid text-on-primary shadow-primary hover:bg-primary-solid-hover disabled:bg-surface-sunken disabled:text-text-faint disabled:shadow-none',
        secondary:
          'border border-border bg-surface text-text shadow-xs hover:border-border-strong hover:bg-surface-muted disabled:bg-surface-sunken disabled:text-text-faint',
        outline:
          'border border-border bg-surface text-primary-ink shadow-xs hover:border-primary-border hover:bg-primary-subtle disabled:border-border-subtle disabled:bg-surface-sunken disabled:text-text-faint',
        soft: 'bg-primary-soft text-primary-ink hover:bg-primary-soft/70',
        ghost:
          'text-text-secondary hover:bg-surface-sunken hover:text-text disabled:text-text-faint',
        danger:
          'bg-danger-ink text-white hover:bg-danger-ink/90 disabled:bg-surface-sunken disabled:text-text-faint',
      },
      size: {
        sm: 'h-control-sm rounded-md px-3 text-sm',
        md: 'h-control rounded-lg px-4 text-base',
        lg: 'h-11 rounded-lg px-5 text-md',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);
