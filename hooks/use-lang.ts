'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Language } from '@/lib/i18n';

const COOKIE_NAME = 'px-language';
const STORAGE_KEY = 'px-language';

/**
 * Get language from cookie or localStorage
 */
function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'ar';
  
  // Try cookie first
  const cookies = document.cookie.split(';');
  const langCookie = cookies.find(c => c.trim().startsWith(`${COOKIE_NAME}=`));
  if (langCookie) {
    const value = langCookie.split('=')[1]?.trim();
    if (value === 'en' || value === 'ar') {
      return value;
    }
  }
  
  // Fallback to localStorage
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'ar') {
    return stored;
  }
  
  return 'ar'; // Default to Arabic
}

/**
 * Set language in cookie and localStorage
 */
function setStoredLanguage(lang: Language): void {
  if (typeof window === 'undefined') return;
  
  // Set cookie (expires in 1 year)
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `${COOKIE_NAME}=${lang}; expires=${expires.toUTCString()}; path=/`;
  
  // Set localStorage
  localStorage.setItem(STORAGE_KEY, lang);
  
  // Update document direction
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
}

// Global state to sync across all hook instances
let globalLanguage: Language = 'ar';
const listeners = new Set<(lang: Language) => void>();

/**
 * Hook to manage language state
 * @returns { language, setLanguage, dir, isRTL }
 */
export function useLang() {
  // Default to 'ar' on server to match layout.tsx default
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'ar';
    const stored = getStoredLanguage();
    globalLanguage = stored;
    return stored;
  });
  
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Initialize from storage
    const stored = getStoredLanguage();
    if (stored !== globalLanguage) {
      globalLanguage = stored;
      setLanguageState(stored);
    }
    
    // Set initial direction
    setStoredLanguage(stored);

    // Listen for storage changes (from other tabs/windows)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const newLang = e.newValue as Language;
        if (newLang === 'en' || newLang === 'ar') {
          globalLanguage = newLang;
          setLanguageState(newLang);
          setStoredLanguage(newLang);
        }
      }
    };

    // Listen for custom language change events
    const handleLanguageChange = (e: CustomEvent<{ language: Language }>) => {
      const newLang = e.detail.language;
      if (newLang !== language) {
        globalLanguage = newLang;
        setLanguageState(newLang);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('languageChanged', handleLanguageChange as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('languageChanged', handleLanguageChange as EventListener);
    };
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    globalLanguage = lang;
    setLanguageState(lang);
    setStoredLanguage(lang);
    // Trigger a custom event to notify other components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
    }
  }, []);

  // Use default 'ar' until mounted to prevent hydration mismatch
  const safeLanguage = mounted ? language : 'ar';
  const dir = safeLanguage === 'ar' ? 'rtl' : 'ltr';
  const isRTL = safeLanguage === 'ar';

  return {
    language: safeLanguage,
    setLanguage,
    dir,
    isRTL,
  };
}
