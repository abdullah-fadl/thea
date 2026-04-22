'use client';

import useSWR from 'swr';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useLang } from '@/hooks/use-lang';
import { VitalsChart } from '@/components/clinical/VitalsChart';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function PatientGrowth({ params }: { params: { patientMasterId: string } }) {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { hasPermission, isLoading } = useRoutePermission('/patient/growth');
  const patientId = String(params.patientMasterId || '');

  const { data: profileData } = useSWR(
    hasPermission && patientId ? `/api/patients/${encodeURIComponent(patientId)}` : null,
    fetcher
  );
  const { data: vitalsData } = useSWR(
    hasPermission && patientId ? `/api/patients/${encodeURIComponent(patientId)}/vitals-history` : null,
    fetcher
  );

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  const patient = profileData?.patient || null;
  const items = Array.isArray(vitalsData?.items) ? vitalsData.items : [];
  const chartData = items.map((item: any) => ({
    date: item.date,
    weight: item.weight ?? null,
    height: item.height ?? null,
  }));

  const latest = items[items.length - 1];
  const latestBmi = latest?.bmi ?? (latest?.weight && latest?.height ? Math.round((latest.weight / ((latest.height / 100) ** 2)) * 10) / 10 : null);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-foreground">{tr('مخططات النمو', 'Growth Charts')}</div>
          <div className="text-sm text-muted-foreground">
            {patient?.fullName || patient?.displayName || tr('مريض', 'Patient')} • {patient?.gender || '—'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="text-sm text-muted-foreground">{tr('آخر وزن', 'Latest Weight')}</div>
          <div className="text-2xl font-bold">{latest?.weight ?? '—'} kg</div>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="text-sm text-muted-foreground">{tr('آخر طول', 'Latest Height')}</div>
          <div className="text-2xl font-bold">{latest?.height ?? '—'} cm</div>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="text-sm text-muted-foreground">{tr('مؤشر كتلة الجسم', 'BMI')}</div>
          <div className="text-2xl font-bold">{latestBmi ?? '—'}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VitalsChart data={chartData} metric="weight" />
        <VitalsChart data={chartData} metric="height" />
      </div>

      <div className="bg-card rounded-2xl border border-border p-4">
        <div className="text-sm text-muted-foreground mb-3">{tr('سجل القياسات', 'Measurements Log')}</div>
        <div className="overflow-x-auto">
          {/* Header */}
          <div className="grid grid-cols-4 gap-4 px-4 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التاريخ', 'Date')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الوزن', 'Weight')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الطول', 'Height')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('مؤشر كتلة الجسم', 'BMI')}</span>
          </div>
          {/* Body */}
          {items.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              {tr('لا توجد قياسات', 'No measurements')}
            </div>
          ) : (
            items.map((item: any, idx: number) => (
              <div key={`${item.date || idx}`} className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                <span className="text-sm text-muted-foreground">{item.date ? new Date(item.date).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : '—'}</span>
                <span className="text-sm text-foreground">{item.weight ?? '—'} kg</span>
                <span className="text-sm text-foreground">{item.height ?? '—'} cm</span>
                <span className="text-sm text-foreground">{item.bmi ?? '—'}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
