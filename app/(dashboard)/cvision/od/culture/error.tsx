'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLang } from '@/hooks/use-lang';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { language } = useLang();
  const { C, isDark } = useCVisionTheme();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  useEffect(() => { console.error('[ErrorBoundary]', { route: pathname, error }); }, [pathname, error]);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 24px' }}>
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{tr('حدث خطأ', 'Something went wrong')}</h3>
        </CVisionCardHeader>
        <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
          <div>
            <div style={{ color: C.textMuted }}>{tr('المسار', 'Route')}</div>
            <div style={{ fontFamily: 'monospace' }}>{pathname}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
            <CVisionButton C={C} isDark={isDark} onClick={() => reset()}>{tr('إعادة المحاولة', 'Try again')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => router.replace('/welcome')}>
              {tr('الذهاب للرئيسية', 'Go to Welcome')}
            </CVisionButton>
          </div>
        </CVisionCardBody>
      </CVisionCard>
    </div>
  );
}

