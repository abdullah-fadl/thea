'use client';

import { cn } from '@/lib/utils';

interface TheaSoftButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function TheaSoftButton({ children, className, ...props }: TheaSoftButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'h-[34px] px-3 rounded-xl',
        'border border-border bg-muted/50',
        'text-xs font-medium text-foreground',
        'cursor-pointer thea-transition-fast',
        'hover:bg-muted hover:-translate-y-px',
        className,
      )}
    >
      {children}
    </button>
  );
}
