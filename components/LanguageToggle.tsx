'use client';

import { Button } from '@/components/ui/button';
import { useLang } from '@/hooks/use-lang';
import { Languages } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

export function LanguageToggle() {
  const { language, setLanguage } = useLang();
  const [isMounted, setIsMounted] = useState(false);

  // Handle client-side mounting to prevent hydration errors
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Force re-render when language changes globally
  useEffect(() => {
    const handleLanguageChange = () => {
      // Force component re-render
      window.dispatchEvent(new Event('resize'));
    };
    
    window.addEventListener('languageChanged', handleLanguageChange);
    return () => window.removeEventListener('languageChanged', handleLanguageChange);
  }, []);

  // Use displayLanguage to prevent hydration mismatch
  const displayLanguage = isMounted ? language : 'en';

  const handleLanguageChange = () => {
    const newLang = displayLanguage === 'ar' ? 'en' : 'ar';
    setLanguage(newLang);
    // Scroll to top when language changes
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleLanguageChange}
      className={cn('h-9 w-9')}
      aria-label="Toggle language"
    >
      <Languages className="h-5 w-5" />
    </Button>
  );
}
