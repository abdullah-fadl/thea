'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { DischargeMedRec } from '@/components/clinical/DischargeMedRec';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import type { ReconciliationItem } from '@/components/clinical/MedReconciliation';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function DischargePanel({ visitId }: { visitId: string }) {
  const { toast } = useToast();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const router = useRouter();
  const [discharging, setDischarging] = useState(false);

  const { data: summaryData } = useSWR(visitId ? `/api/opd/encounters/${visitId}/summary` : null, fetcher);
  const patientId = String(summaryData?.patient?.id || '').trim();

  const { data: homeMedsData } = useSWR(
    patientId ? `/api/clinical/home-medications/${encodeURIComponent(patientId)}` : null,
    fetcher
  );

  const { data: medReconData, mutate: mutateMedRecon } = useSWR(
    visitId ? `/api/clinical/med-reconciliation/${encodeURIComponent(visitId)}` : null,
    fetcher
  );

  // Fetch encounter prescriptions/medication orders
  const { data: ordersData } = useSWR(
    visitId ? `/api/orders?encounterCoreId=${visitId}` : null,
    fetcher
  );

  const reconRecord = medReconData as Record<string, unknown> | undefined;
  const medReconItems = Array.isArray(reconRecord?.items) ? reconRecord.items : [];
  const admissionRecon = medReconItems.find((item: any) => item.type === 'admission');
  const admissionItems: ReconciliationItem[] = Array.isArray(admissionRecon?.items) ? admissionRecon.items : [];

  // Extract medication orders as hospital medications for discharge
  const allOrders = Array.isArray(ordersData?.items) ? ordersData.items : [];
  const hospitalMedications = allOrders
    .filter((o: any) => {
      const k = String(o.kind || '').toUpperCase();
      return (k === 'MEDICATION' || k === 'MED') && o.status !== 'CANCELLED';
    })
    .map((o: any) => {
      const meta = (typeof o.meta === 'object' && o.meta) || {};
      return {
        id: o.id,
        drugName: o.orderName || meta.medicationName || o.itemName || o.name || '',
        dose: meta.dose || o.dose || '',
        unit: meta.unit || o.unit || 'mg',
        frequency: meta.frequency || o.frequency || '',
        route: meta.route || o.route || 'PO',
        duration: meta.duration || o.duration || '',
        status: 'active',
      };
    });

  const handleComplete = async (items: any[]) => {
    if (!visitId) return;
    try {
      const res = await fetch(`/api/clinical/med-reconciliation/${encodeURIComponent(visitId)}`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'discharge',
          items,
          homeMedications: Array.isArray(homeMedsData?.items) ? homeMedsData.items : [],
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to save discharge reconciliation');
      toast({ title: tr('تم الحفظ', 'Saved'), description: tr('تم حفظ مطابقة أدوية الخروج.', 'Discharge reconciliation saved.') });
      await mutateMedRecon();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    }
  };

  const handleDischarge = async () => {
    if (!visitId) return;
    setDischarging(true);
    try {
      const res = await fetch(`/api/opd/encounters/${visitId}/status`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || tr('فشل إكمال الخروج', 'Failed to complete discharge'));
      toast({
        title: tr('تم الخروج', 'Discharge Complete'),
        description: tr('تم إكمال خروج المريض بنجاح.', 'Patient discharge completed successfully.'),
      });
      router.push('/opd');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : tr('فشلت العملية', 'Failed');
      toast({
        title: tr('خطأ', 'Error'),
        description: message,
        variant: 'destructive' as const,
      });
    } finally {
      setDischarging(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">{tr('الخروج', 'Discharge')}</h2>
      <DischargeMedRec
        key={`${visitId}-${hospitalMedications.length}-${admissionItems.length}`}
        patientId={patientId}
        encounterId={visitId}
        admissionReconciliation={admissionItems}
        hospitalMedications={hospitalMedications}
        onComplete={handleComplete}
        onPrint={() => window.print()}
        onCancel={() => null}
      />
      <div className="mt-6 border-t border-slate-200 pt-4 flex justify-end">
        <button
          onClick={handleDischarge}
          disabled={discharging}
          className="px-6 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {discharging ? tr('جاري الخروج...', 'Discharging...') : tr('إكمال الخروج', 'Complete Discharge')}
        </button>
      </div>
    </div>
  );
}
