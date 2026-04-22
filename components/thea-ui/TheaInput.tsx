'use client';

import { cn } from '@/lib/utils';

interface TheaInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
}

export function TheaInput({ label, icon, className, ...props }: TheaInputProps) {
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="block text-[11px] text-muted-foreground font-semibold mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute top-1/2 -translate-y-1/2 text-muted-foreground start-3 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          {...props}
          className={cn(
            'w-full py-2.5 rounded-xl',
            'border-[1.5px] border-border bg-muted/30',
            'text-[13px] text-foreground placeholder:text-muted-foreground',
            'outline-none thea-input-focus thea-transition-fast',
            icon ? 'ps-9 pe-3' : 'px-3',
          )}
        />
      </div>
    </div>
  );
}
