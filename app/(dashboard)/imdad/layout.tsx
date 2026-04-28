'use client';

import { ReactNode } from 'react';
import { useLang } from '@/hooks/use-lang';
import ImdadSidebar from '@/components/imdad/layout/ImdadSidebar';
import GlobalSearch from '@/components/imdad/shared/GlobalSearch';
import { IdentityBar } from '@/components/imdad/layout/IdentityBar';

interface ImdadLayoutProps {
  children: ReactNode;
}

export default function ImdadLayout({ children }: ImdadLayoutProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  return (
    <div
      className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <ImdadSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Identity Bar — server-resolved canonical identity */}
        <IdentityBar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
