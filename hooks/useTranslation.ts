/**
 * useTranslation hook — thin wrapper around useLang for CVision components
 */
'use client';

import { useLang } from '@/hooks/use-lang';

export function useTranslation() {
  const { language, setLanguage } = useLang();
  return {
    locale: language,
    changeLocale: (newLocale: string) => setLanguage(newLocale as 'ar' | 'en'),
    t: (ar: string, en: string) => (language === 'ar' ? ar : en),
  };
}
