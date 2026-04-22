'use client';

import { useLang } from '@/hooks/use-lang';

export function SkipToContent() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {tr('تخطي إلى المحتوى الرئيسي', 'Skip to main content')}
    </a>
  );
}
