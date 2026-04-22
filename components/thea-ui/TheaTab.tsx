'use client';

import { cn } from '@/lib/utils';

interface TheaTabProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function TheaTab({ label, active = false, onClick }: TheaTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-[34px] px-3.5 rounded-full border font-medium text-[13px] whitespace-nowrap shrink-0 thea-transition-fast',
        active
          ? 'bg-primary border-primary text-white font-bold'
          : 'bg-card border-border text-foreground hover:-translate-y-px hover:shadow-sm',
      )}
    >
      {label}
    </button>
  );
}
