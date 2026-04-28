'use client';

import { useMemo } from 'react';
import { useLang } from '@/hooks/use-lang';
import {
  formatDateForDisplay,
  formatDualDate,
  formatHijriDate,
  getHijriYear,
  isRamadan,
} from '@/lib/utils/hijriDate';

/**
 * React hook that provides Hijri date formatting functions
 * bound to the current language context.
 *
 * Usage:
 * ```tsx
 * const { formatDate, todayHijri, todayDual, isRamadan } = useHijriDate();
 * ```
 */
export function useHijriDate() {
  const { language } = useLang();

  return useMemo(() => {
    const now = new Date();

    return {
      /** Format a date as dual Hijri/Gregorian (default) */
      formatDate: (date: Date | string | null) =>
        formatDateForDisplay(date, language, { dual: true }),

      /** Format a date as Hijri only */
      formatHijri: (date: Date | string | null) =>
        formatDateForDisplay(date, language, { hijriOnly: true }),

      /** Format a date as Gregorian only */
      formatGregorian: (date: Date | string | null) =>
        formatDateForDisplay(date, language, { gregorianOnly: true }),

      /** Format a date as full dual string */
      formatDual: (date: Date | string | null) => {
        if (!date) return '';
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return '';
        return formatDualDate(d, language);
      },

      /** Today's Hijri date string */
      todayHijri: formatHijriDate(now, language),

      /** Today's dual date string */
      todayDual: formatDualDate(now, language),

      /** Current Hijri year (e.g. 1446) */
      currentHijriYear: getHijriYear(),

      /** Whether today is in Ramadan */
      isRamadan: isRamadan(),
    };
  }, [language]);
}
