'use client';
import { useLang } from '@/hooks/use-lang';
import { Globe } from 'lucide-react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { CVisionButton } from '@/components/cvision/ui';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLang();
  const { C, isDark } = useCVisionTheme();

  return (
    <CVisionButton
      C={C}
      isDark={isDark}
      variant="ghost"
      size="sm"
      icon={<Globe size={14} />}
      onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
    >
      {language === 'ar' ? 'English' : 'العربية'}
    </CVisionButton>
  );
}
