'use client';

import { useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLang } from '@/hooks/use-lang';

export default function ErrorBoundary({
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

  useEffect(() => {
    console.error('[ErrorBoundary]', { route: pathname, error });
  }, [pathname, error]);

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-3xl">
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>{tr('حدث خطأ', 'Something went wrong')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <div className="text-muted-foreground">{tr('المسار', 'Route')}</div>
            <div className="font-mono">{pathname}</div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => reset()}>{tr('إعادة المحاولة', 'Try again')}</Button>
            <Button variant="outline" onClick={() => router.replace('/welcome')}>
              {tr('الذهاب للرئيسية', 'Go to Welcome')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
