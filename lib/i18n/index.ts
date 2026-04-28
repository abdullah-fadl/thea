import { en } from './en';
import { ar } from './ar';
import type { Language } from './types';

export type { Translations } from './types';
export type { Language } from './types';

type TranslationTree = Record<string, any>;

export const translations: Record<'en' | 'ar', TranslationTree> = {
  en,
  ar,
};

/**
 * Translation function
 * @param key - Dot-separated key path (e.g., 'px.setup.title')
 * @param lang - Language code ('en' | 'ar')
 * @returns Translated string or the key if not found
 */
export function t(key: string, lang: Language = 'en'): string {
  const keys = key.split('.');
  let value: any = translations[lang];
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return key; // Return key if path not found
    }
  }
  
  return typeof value === 'string' ? value : key;
}

/**
 * Get all translations for a given key path
 * @param key - Dot-separated key path
 * @returns Object with 'en' and 'ar' translations
 */
export function getTranslations(key: string): { en: string; ar: string } {
  return {
    en: t(key, 'en'),
    ar: t(key, 'ar'),
  };
}
