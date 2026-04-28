"use client";

import { useEffect } from "react";
import { useLang } from '@/hooks/use-lang';
import WebsiteNavbar from './WebsiteNavbar';
import WebsiteFooter from './WebsiteFooter';

export default function WebsiteShell({ children }: { children: React.ReactNode }) {
  const { language } = useLang();

  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains('dark');
    // Keep marketing pages readable regardless of previously persisted app theme.
    root.classList.remove('dark');
    return () => {
      if (hadDark) {
        root.classList.add('dark');
      }
    };
  }, []);

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} lang={language} className="font-sans bg-white dark:bg-thea-dark text-slate-900 dark:text-white min-h-screen">
      <WebsiteNavbar />
      <main className="min-h-screen">{children}</main>
      <WebsiteFooter />
    </div>
  );
}
