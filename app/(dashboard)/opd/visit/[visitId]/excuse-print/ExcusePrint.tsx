'use client';

import useSWR from 'swr';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useLang } from '@/hooks/use-lang';
import { Printer } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function ExcusePrint(props: any) {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { hasPermission, isLoading } = useRoutePermission('/opd/visit');
  const visitId = String(props?.params?.visitId || '').trim();
  const encounterCoreId = visitId;

  const { data: encounterData } = useSWR(
    hasPermission && encounterCoreId ? `/api/encounters/${encodeURIComponent(encounterCoreId)}` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: bookingData } = useSWR(
    hasPermission && encounterCoreId
      ? `/api/opd/booking/by-encounter?encounterCoreId=${encodeURIComponent(encounterCoreId)}`
      : null,
    fetcher,
    { refreshInterval: 0 }
  );

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  const patient = encounterData?.patient || null;
  const doctorName = bookingData?.provider?.displayName || tr('الطبيب', 'Doctor');
  const now = new Date();

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <button
          onClick={() => window.history.back()}
          className="px-3 py-1.5 rounded-xl bg-card text-foreground text-xs font-medium border border-border"
        >
          {tr('← رجوع', '← Back')}
        </button>
        <button
          onClick={() => window.print()}
          className="px-4 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-medium"
        >
          <Printer className="h-3 w-3 inline mr-1" />{tr('طباعة', 'Print')}
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="text-center mb-6">
          <div className="text-lg font-semibold">{tr('خطاب عذر طبي', 'Medical Excuse Letter')}</div>
          <div className="text-xs text-muted-foreground">{now.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}</div>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            {tr('نشهد بأن', 'This is to certify that')} <strong>{patient?.fullName || tr('المريض', 'the patient')}</strong> {tr('تمت معاينته في هذه المنشأة.', 'was seen at this facility.')}
          </div>
          <div>
            {tr('الطبيب المعالج', 'Attending clinician')}: <strong>{doctorName}</strong>
          </div>
          <div>
            {tr('تاريخ الزيارة', 'Visit date')}: <strong>{now.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}</strong>
          </div>
        </div>

        <div className="mt-10 text-sm text-muted-foreground">
          {tr('التوقيع', 'Signature')}: ______________________
        </div>
      </div>
    </div>
  );
}
