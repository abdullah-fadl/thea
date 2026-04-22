import { cn } from '@/lib/utils';
import { Timer } from 'lucide-react';

interface TheaWaitBadgeProps {
  minutes: number;
}

export function TheaWaitBadge({ minutes }: TheaWaitBadgeProps) {
  const isHigh = minutes > 20;
  const isMedium = minutes > 10;

  return (
    <span
      className={cn(
        'text-[11px] font-bold tabular-nums inline-flex items-center gap-0.5',
        isHigh
          ? 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950 px-[7px] py-[2px] rounded'
          : isMedium
            ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-[7px] py-[2px] rounded'
            : 'text-muted-foreground',
      )}
    >
      {minutes}m
      {(isHigh || isMedium) && <Timer className="h-3 w-3 ml-0.5" />}
    </span>
  );
}
