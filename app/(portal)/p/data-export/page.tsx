'use client';

import { useState } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileJson, Loader2, CheckCircle2, AlertCircle, Clock, Shield } from 'lucide-react';

export default function PortalDataExportPage() {
  const { language } = useLang();
  const isAr = language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'rate_limited'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleExport() {
    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch('/api/portal/data-export', { credentials: 'include' });

      if (res.status === 429) {
        setStatus('rate_limited');
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }));
        setErrorMessage(body.error ?? 'Unknown error');
        setStatus('error');
        return;
      }

      // Trigger download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const disposition = res.headers.get('Content-Disposition');
      const fileNameMatch = disposition?.match(/filename="?([^"]+)"?/);
      anchor.download = fileNameMatch?.[1] ?? `my-health-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setStatus('success');
    } catch {
      setErrorMessage(tr('حدث خطأ غير متوقع', 'An unexpected error occurred'));
      setStatus('error');
    }
  }

  const dataCategories = [
    { ar: 'البيانات الديموغرافية', en: 'Demographics' },
    { ar: 'الزيارات والمواعيد', en: 'Encounters & visits' },
    { ar: 'الأوامر الطبية', en: 'Clinical orders' },
    { ar: 'الملاحظات السريرية', en: 'Clinical notes' },
    { ar: 'الموافقات', en: 'Consents' },
    { ar: 'زيارات العيادات الخارجية', en: 'OPD visits' },
  ];

  return (
    <div className="space-y-6 max-w-2xl mx-auto" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Download className="h-6 w-6 text-primary" />
          {tr('تحميل بياناتي', 'Download My Data')}
        </h1>
        <p className="text-muted-foreground mt-2">
          {tr(
            'وفقاً لنظام حماية البيانات الشخصية (PDPL)، يحق لك الحصول على نسخة من بياناتك الصحية المخزنة في النظام بصيغة قابلة للقراءة.',
            'Under the Personal Data Protection Law (PDPL), you have the right to receive a copy of your health data stored in the system in a portable format.',
          )}
        </p>
      </div>

      {/* Data categories card */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <FileJson className="h-5 w-5 text-muted-foreground" />
            {tr('البيانات المتضمنة في التصدير', 'Data included in the export')}
          </h2>
          <ul className="space-y-2">
            {dataCategories.map((cat, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                {tr(cat.ar, cat.en)}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Rate limit notice */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="pt-6 flex items-start gap-3">
          <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            {tr(
              'يمكنك تصدير بياناتك مرة واحدة كل ساعة. يتم تنزيل الملف بصيغة JSON.',
              'You can export your data once per hour. The file is downloaded in JSON format.',
            )}
          </p>
        </CardContent>
      </Card>

      {/* Privacy notice */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6 flex items-start gap-3">
          <Shield className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            {tr(
              'يتم تسجيل كل عملية تصدير في سجل المراجعة لضمان أمن بياناتك.',
              'Every export is logged in the audit trail to ensure your data security.',
            )}
          </p>
        </CardContent>
      </Card>

      {/* Export button */}
      <div className="pt-2">
        <Button
          onClick={handleExport}
          disabled={status === 'loading'}
          size="lg"
          className="w-full"
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {tr('جاري التحميل...', 'Exporting...')}
            </>
          ) : (
            <>
              <Download className="h-5 w-5" />
              {tr('تحميل بياناتي', 'Download My Data')}
            </>
          )}
        </Button>
      </div>

      {/* Success state */}
      {status === 'success' && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <p className="text-sm text-green-800">
              {tr(
                'تم تحميل بياناتك بنجاح. تحقق من مجلد التنزيلات.',
                'Your data has been downloaded successfully. Check your downloads folder.',
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Rate limited state */}
      {status === 'rate_limited' && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              {tr(
                'لقد قمت بالتصدير مؤخراً. يرجى الانتظار ساعة واحدة قبل المحاولة مرة أخرى.',
                'You have exported recently. Please wait one hour before trying again.',
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error state */}
      {status === 'error' && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            <p className="text-sm text-red-800">
              {errorMessage || tr('فشل التصدير. يرجى المحاولة لاحقاً.', 'Export failed. Please try again later.')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
