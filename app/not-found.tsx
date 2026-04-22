'use client';

import Link from 'next/link';
import { useLang } from '@/hooks/use-lang';

/**
 * Global 404 — Page Not Found (bilingual)
 */
export default function NotFound() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <span className="text-4xl font-bold text-muted-foreground">404</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {tr('الصفحة غير موجودة', 'Page Not Found')}
          </h1>
          <p className="text-muted-foreground">
            {tr(
              'عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.',
              'Sorry, the page you are looking for does not exist or has been moved.'
            )}
          </p>
        </div>

        <div className="flex justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            {tr('الصفحة الرئيسية', 'Go to Dashboard')}
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            {tr('رجوع', 'Go Back')}
          </button>
        </div>
      </div>
    </div>
  );
}
