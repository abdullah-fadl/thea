'use client';

import { createContext, useContext, useEffect } from 'react';
import { useLang } from '@/hooks/use-lang';

interface PlatformContextType {
  initialPlatform: string | null;
}

const PlatformContext = createContext<PlatformContextType | undefined>(undefined);

/**
 * Language Provider Component
 * This component should be included in the root layout to ensure
 * language settings are applied globally
 */
export function LanguageProvider({ 
  children, 
  initialPlatform 
}: { 
  children: React.ReactNode;
  initialPlatform?: string | null;
}) {
  const { language, dir } = useLang();

  useEffect(() => {
    // Update document direction and language
    if (typeof document !== 'undefined') {
      document.documentElement.dir = dir;
      document.documentElement.lang = language;
    }
  }, [language, dir]);

  return (
    <PlatformContext.Provider value={{ initialPlatform: initialPlatform || null }}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatformContext() {
  const context = useContext(PlatformContext);
  return context?.initialPlatform || null;
}

