'use client';

import { useLang } from '@/hooks/use-lang';
import { formatDateForDisplay, formatDualDate, formatHijriDate } from '@/lib/utils/hijriDate';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HijriDateDisplayProps {
  /** The date to display. Accepts Date, ISO string, or null. */
  date: Date | string | null;
  /** Display mode: 'dual' (default), 'hijri', or 'gregorian'. */
  mode?: 'dual' | 'hijri' | 'gregorian';
  /** Additional CSS class names. */
  className?: string;
  /** Show a small calendar icon before the date text. Default: true. */
  showIcon?: boolean;
}

/**
 * A reusable component for displaying dates with Hijri / Gregorian support.
 *
 * Renders based on the current language and the selected mode:
 * - **dual**: "٢ رمضان ١٤٤٦ هـ / ٢ مارس ٢٠٢٥ م"
 * - **hijri**: "٢ رمضان ١٤٤٦"
 * - **gregorian**: "٢ مارس ٢٠٢٥"
 */
export function HijriDateDisplay({
  date,
  mode = 'dual',
  className,
  showIcon = true,
}: HijriDateDisplayProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  if (!date) return null;

  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;

  let displayText: string;
  switch (mode) {
    case 'hijri':
      displayText = formatDateForDisplay(d, language, { hijriOnly: true });
      break;
    case 'gregorian':
      displayText = formatDateForDisplay(d, language, { gregorianOnly: true });
      break;
    case 'dual':
    default:
      displayText = formatDualDate(d, language);
      break;
  }

  if (!displayText) return null;

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-sm text-muted-foreground', className)}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      title={tr('التاريخ الهجري والميلادي', 'Hijri and Gregorian date')}
    >
      {showIcon && <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />}
      <span>{displayText}</span>
    </span>
  );
}
