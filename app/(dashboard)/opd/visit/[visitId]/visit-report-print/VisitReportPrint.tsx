'use client';

import useSWR from 'swr';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useLang } from '@/hooks/use-lang';
import { getPatientMrn } from '@/lib/opd/ui-helpers';
import { Printer } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function VisitReportPrint(props: any) {
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
  const { data: notesData } = useSWR(
    hasPermission && encounterCoreId ? `/api/opd/encounters/${encodeURIComponent(encounterCoreId)}/visit-notes` : null,
    fetcher,
    { refreshInterval: 0 }
  );

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  const encounter = encounterData?.encounter || null;
  const patient = encounterData?.patient || null;
  const notes = Array.isArray(notesData?.items) ? notesData.items : [];
  const latest = notes[0];
  const now = new Date();

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <button
          onClick={() => window.history.back()}
          className="px-3 py-1.5 rounded-xl bg-card text-foreground text-xs font-medium border border-border"
        >
          {tr('→ رجوع', '← Back')}
        </button>
        <button
          onClick={() => window.print()}
          className="px-4 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-medium"
        >
          <Printer className="h-3 w-3 inline mr-1" />{tr('طباعة', 'Print')}
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-lg font-semibold">{tr('تقرير الزيارة', 'Visit Report')}</div>
            <div className="text-xs text-muted-foreground">{now.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}</div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {tr('الزيارة', 'Visit')}: {encounter?.id || encounterCoreId}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm mb-6">
          <div>
            <div className="text-xs text-muted-foreground">{tr('المريض', 'Patient')}</div>
            <div className="font-medium">{patient?.fullName || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{tr('رقم الملف', 'MRN')}</div>
            <div className="font-medium">{getPatientMrn(patient)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{tr('الجنس', 'Gender')}</div>
            <div className="font-medium">{patient?.gender || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{tr('الحالة', 'Status')}</div>
            <div className="font-medium">{encounter?.status || '—'}</div>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">{tr('الشكوى الرئيسية', 'Chief Complaint')}</div>
            <div className="font-medium">{latest?.chiefComplaint || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{tr('التقييم', 'Assessment')}</div>
            <div className="font-medium">{latest?.assessment || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{tr('الخطة', 'Plan')}</div>
            <div className="font-medium">{latest?.plan || '—'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
