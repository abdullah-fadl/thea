'use client';

import { useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLang } from '@/hooks/use-lang';

/**
 * Reusable error page component.
 * Shows a bilingual (AR/EN) error message with retry & back buttons.
 */
export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const diagnosticId = useMemo(() => {
    try {
      return crypto.randomUUID();
    } catch {
      return `diag_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    }
  }, []);

  const timestamp = useMemo(() => new Date().toISOString(), []);

  useEffect(() => {
    console.error('[PageError]', { diagnosticId, timestamp, route: pathname, error });
  }, [diagnosticId, timestamp, pathname, error]);

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-xl min-h-[60vh] flex items-center justify-center">
      <Card className="w-full border-destructive/40">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <CardTitle className="text-lg">{tr('حدث خطأ غير متوقع', 'An unexpected error occurred')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            {tr(
              'نعتذر عن هذا الخطأ. يمكنك المحاولة مرة أخرى أو العودة للصفحة السابقة.',
              'We apologize for this error. You can try again or go back to the previous page.'
            )}
          </p>

          <div className="flex justify-center gap-3">
            <Button onClick={() => reset()}>{tr('حاول مرة أخرى', 'Try Again')}</Button>
            <Button variant="outline" onClick={() => router.back()}>
              {tr('رجوع', 'Go Back')}
            </Button>
          </div>

          <details className="text-start text-xs text-muted-foreground pt-2">
            <summary className="cursor-pointer hover:text-foreground">{tr('تفاصيل تقنية', 'Technical Details')}</summary>
            <div className="mt-2 space-y-1 font-mono bg-muted/50 rounded-lg p-3">
              <div>
                <span className="text-muted-foreground">{tr('الوقت:', 'Time:')} </span>
                {timestamp}
              </div>
              <div>
                <span className="text-muted-foreground">{tr('المسار:', 'Path:')} </span>
                {pathname}
              </div>
              <div>
                <span className="text-muted-foreground">{tr('معرّف:', 'ID:')} </span>
                {diagnosticId}
              </div>
              {error.message && (
                <div>
                  <span className="text-muted-foreground">{tr('الخطأ:', 'Error:')} </span>
                  {error.message}
                </div>
              )}
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
