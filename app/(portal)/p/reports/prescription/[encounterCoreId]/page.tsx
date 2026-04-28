'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/time/format';
import { useLang } from '@/hooks/use-lang';

type Medication = {
  id: string;
  drugName: string | null;
  dose: string | null;
  frequency: string | null;
  route: string | null;
  duration: string | null;
  instructions: string | null;
  status: string | null;
  createdAt: string | null;
};

type PrescriptionData = {
  encounterCoreId: string;
  patient: { name: string | null; mrn: string | null; dob: string | null } | null;
  encounterDate: string | null;
  medications: Medication[];
};

export default function PortalPrescriptionPage() {
  const router = useRouter();
  const params = useParams();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const encounterCoreId = String(params?.encounterCoreId || '');
  const [data, setData] = useState<PrescriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!encounterCoreId) return;
    setLoading(true);
    fetch(`/api/portal/reports/${encodeURIComponent(encounterCoreId)}/prescription`, { credentials: 'include' })
      .then((res) => {
        if (res.status === 401) {
          router.replace('/p/login');
          return null;
        }
        if (!res.ok) throw new Error('Failed to load prescription');
        return res.json();
      })
      .then((d) => {
        if (d) setData(d);
      })
      .catch((err) => setError(err?.message || 'Error loading prescription'))
      .finally(() => setLoading(false));
  }, [encounterCoreId, router]);

  if (loading) return <div className="p-4 text-sm text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>;
  if (error) return <div className="p-4 text-sm text-red-600">{error}</div>;
  if (!data) return <div className="p-4 text-sm text-muted-foreground">{tr('لا توجد بيانات.', 'No data available.')}</div>;

  return (
    <div className="space-y-4 max-w-2xl mx-auto print:max-w-none">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="outline" size="sm" onClick={() => router.push('/p/reports')}>
          {tr('← العودة للتقارير', '← Back to Reports')}
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          {tr('طباعة الوصفة', 'Print Prescription')}
        </Button>
      </div>

      <div className="border rounded-md p-4 space-y-3">
        <div className="text-center border-b pb-3">
          <div className="text-lg font-bold">Thea Health</div>
          <div className="text-sm text-muted-foreground">Prescription / وصفة طبية</div>
        </div>

        {data.patient && (
          <div className="grid grid-cols-2 gap-2 text-sm border-b pb-3">
            <div>
              <span className="text-muted-foreground">المريض / Patient: </span>
              <span className="font-medium">{data.patient.name || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">رقم الملف / MRN: </span>
              <span className="font-medium">{data.patient.mrn || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">تاريخ الميلاد / DOB: </span>
              <span className="font-medium">{data.patient.dob || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">التاريخ / Date: </span>
              <span className="font-medium">{formatDateTime(data.encounterDate, { timeZone: 'UTC' }) || '—'}</span>
            </div>
          </div>
        )}

        <div className="text-sm font-semibold">Medications / الأدوية</div>

        {data.medications.length === 0 && (
          <div className="text-sm text-muted-foreground">لا توجد أدوية موصوفة / No medications prescribed.</div>
        )}

        <div className="space-y-2">
          {data.medications.map((med, idx) => (
            <div key={med.id} className="border rounded-md p-3 text-sm space-y-1">
              <div className="font-medium">
                {idx + 1}. {med.drugName || 'Unknown'}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {med.dose && <div>الجرعة / Dose: {med.dose}</div>}
                {med.frequency && <div>التكرار / Frequency: {med.frequency}</div>}
                {med.route && <div>الطريقة / Route: {med.route}</div>}
                {med.duration && <div>المدة / Duration: {med.duration}</div>}
              </div>
              {med.instructions && (
                <div className="text-xs text-muted-foreground">التعليمات / Instructions: {med.instructions}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
