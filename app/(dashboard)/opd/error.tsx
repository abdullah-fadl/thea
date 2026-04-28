'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

export default function OPDErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  useEffect(() => {
    console.error('[OPD Error]', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-4 max-w-md">
        <div className="flex justify-center"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>
        <h2 className="text-lg font-semibold text-slate-900">{tr('حدث خطأ', 'An error occurred')}</h2>
        <p className="text-sm text-slate-500">
          {tr('عذراً، حدث خطأ غير متوقع. الرجاء المحاولة مرة أخرى.', 'Sorry, an unexpected error occurred. Please try again.')}
        </p>
        {error?.message && (
          <pre className="text-xs text-red-600 bg-red-50 rounded-lg p-3 text-left overflow-auto max-h-32">
            {error.message}
          </pre>
        )}
        <div className="flex gap-2 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
          >
            {tr('إعادة المحاولة', 'Try again')}
          </button>
          <button
            onClick={() => window.location.href = '/opd/dashboard'}
            className="px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50"
          >
            {tr('العودة للوحة التحكم', 'Back to Dashboard')}
          </button>
        </div>
      </div>
    </div>
  );
}
