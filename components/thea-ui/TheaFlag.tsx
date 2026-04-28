import { cn } from '@/lib/utils';

interface TheaFlagProps {
  label: string;
  value: string;
  tone?: 'warn' | 'ok' | 'info';
}

const toneStyles: Record<string, string> = {
  warn: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
  ok: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  info: 'bg-primary/10 text-foreground',
};

export function TheaFlag({ label, value, tone = 'info' }: TheaFlagProps) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/50 border border-border">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-xs font-extrabold px-2.5 py-1 rounded-full',
          toneStyles[tone],
        )}
      >
        {value}
      </span>
    </div>
  );
}
