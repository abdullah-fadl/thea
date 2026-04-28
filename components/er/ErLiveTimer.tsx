import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useLang } from '@/hooks/use-lang';

type ErLiveTimerProps = {
  startAt?: string | number | Date | null;
  label?: string;
  className?: string;
};

const toDate = (value?: string | number | Date | null) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatElapsed = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
};

export function ErLiveTimer({ startAt, label, className }: ErLiveTimerProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const displayLabel = label ?? tr('المؤقت', 'Timer');
  const startDate = useMemo(() => toDate(startAt), [startAt]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!startDate) {
    return (
      <div className={cn('text-xs text-muted-foreground', className)}>
        {displayLabel}: —
      </div>
    );
  }

  return (
    <div className={cn('text-xs text-muted-foreground', className)}>
      {displayLabel}:{' '}
      <span className="font-medium text-foreground tabular-nums">{formatElapsed(now - startDate.getTime())}</span>
    </div>
  );
}
