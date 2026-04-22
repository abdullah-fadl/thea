import ar from './ar.json';
import en from './en.json';

const messages: Record<string, Record<string, string>> = { ar, en };

export function t(key: string, locale: string = 'ar', params?: Record<string, string>): string {
  let text = messages[locale]?.[key] || messages['en']?.[key] || key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{{${k}}}`, v);
    });
  }
  return text;
}

export function useLocale(): string {
  if (typeof window === 'undefined') return 'ar';
  const match = document.cookie.match(/cvision_locale=(\w+)/);
  return match?.[1] || 'ar';
}

export function setLocale(locale: string) {
  if (typeof document !== 'undefined') {
    document.cookie = `cvision_locale=${locale};path=/;max-age=${60 * 60 * 24 * 365}`;
  }
}

export function getDirection(locale: string): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export const SUPPORTED_LOCALES = ['ar', 'en'] as const;
export type Locale = typeof SUPPORTED_LOCALES[number];
