'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useLang } from '@/hooks/use-lang';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[patient-experience/cases] error', error);
    }
  }, [error]);

  return (
    <div className="container mx-auto p-6">
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-base font-extrabold mb-2">
          {tr('تعذّر تحميل الحالات', 'Could not load Cases')}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {error?.message || tr('حدث خطأ غير متوقع.', 'An unexpected error occurred.')}
        </p>
        <Button onClick={reset} size="sm">
          {tr('إعادة المحاولة', 'Try again')}
        </Button>
      </div>
    </div>
  );
}
