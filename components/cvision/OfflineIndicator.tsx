'use client';

import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

export default function OfflineIndicator() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="bg-destructive text-destructive-foreground text-sm font-medium flex items-center justify-center gap-2 py-1.5 px-4 z-50">
      <WifiOff className="h-4 w-4" />
      {tr('أنت غير متصل بالإنترنت — ستتم مزامنة التغييرات عند استعادة الاتصال', 'You are offline — changes will sync when connection is restored')}
    </div>
  );
}
