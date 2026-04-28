'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { Pill, Sparkles, BarChart3 } from 'lucide-react';
import { PrescriptionDialog } from '@/components/orders/PrescriptionDialog';
import { getLatestAllergies } from '@/lib/opd/helpers';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const STATUS_STYLES: Record<string, string> = {
  ORDERED: 'bg-amber-100 text-amber-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  DISPENSED: 'bg-emerald-100 text-emerald-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-700 line-through',
};

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  ORDERED: { ar: 'تم الطلب', en: 'Ordered' },
  IN_PROGRESS: { ar: 'قيد التنفيذ', en: 'In progress' },
  DISPENSED: { ar: 'تم الصرف', en: 'Dispensed' },
  COMPLETED: { ar: 'مكتمل', en: 'Completed' },
  CANCELLED: { ar: 'ملغي', en: 'Cancelled' },
};

export default function PrescriptionPanel({ visitId }: { visitId: string }) {
  const { toast } = useToast();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const { data: ordersHubData, mutate } = useSWR(
    visitId ? `/api/orders?encounterCoreId=${visitId}` : null,
    fetcher
  );
  const { data: nursingData } = useSWR(`/api/opd/encounters/${visitId}/nursing`, fetcher);
  const { data: opdData } = useSWR(`/api/opd/encounters/${visitId}`, fetcher);

  const [showPrescription, setShowPrescription] = useState(false);

  const allOrders = Array.isArray(ordersHubData?.items) ? ordersHubData.items : [];
  const meds = allOrders.filter(
    (item: any) =>
      String(item?.kind || item?.category || '').toUpperCase() === 'MEDICATION' ||
      String(item?.kind || item?.category || '').toLowerCase().includes('med')
  );
  const paymentStatus = opdData?.opd?.paymentStatus ?? null;
  const paidAt = opdData?.opd?.paymentPaidAt ?? null;
  const isPaid = paymentStatus === 'PAID' || !!paidAt;
  const getStatusLabel = (status: string) => {
    const s = (status || 'ORDERED').toUpperCase();
    const labels = STATUS_LABELS[s] || { ar: status, en: status };
    return language === 'ar' ? labels.ar : labels.en;
  };

  // Get allergies from nursing entries
  const nursingEntries = Array.isArray(nursingData?.items) ? nursingData.items : [];
  const allergies = getLatestAllergies(
    nursingEntries.length ? nursingEntries : opdData?.opd?.opdNursingEntries
  );

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">{tr('الوصفة الطبية', 'Prescription')}</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPrescription(true)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
            >
              {tr('+ وصفة جديدة', '+ New prescription')}
            </button>
            {meds.length > 0 && (
              <>
                <a
                  href={`/opd/visit/${visitId}/prescription-print`}
                  target="_blank"
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50"
                >
                  {tr('طباعة', 'Print')}
                </a>
                <a
                  href={`/opd/visit/${visitId}/prescription-print-v2`}
                  target="_blank"
                  className="px-4 py-2 border border-indigo-300 text-indigo-700 text-sm rounded-lg hover:bg-indigo-50"
                >
                  <Sparkles className="h-4 w-4 inline-block" /> {tr('طباعة محسّنة', 'Enhanced Print')}
                </a>
              </>
            )}
          </div>
        </div>

        {/* Allergy banner */}
        {allergies && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
            <strong>{tr('حساسية:', 'Allergies:')}</strong>{' '}
            {typeof allergies === 'string' ? allergies : Array.isArray(allergies) ? (allergies as string[]).join(', ') : String(allergies)}
          </div>
        )}

        {meds.length ? (
          <div className="space-y-3">
            {meds.map((med: any) => {
              const meta = med.meta && typeof med.meta === 'object' ? med.meta : {};
              const statusKey = (med.status || 'ORDERED').toUpperCase();
              const isDone = statusKey === 'DISPENSED' || statusKey === 'COMPLETED';
              return (
                <div
                  key={med.id}
                  className="rounded-lg border border-slate-200 p-4 flex flex-wrap items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium text-slate-900">
                        <Pill className="h-4 w-4 inline-block" /> {med.orderName || meta.medicationName || med.title || med.name || tr('دواء', 'Medication')}
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          STATUS_STYLES[statusKey] || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {getStatusLabel(med.status)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
                      <span className={isPaid ? 'text-emerald-600' : 'text-amber-600'}>
                        {tr('الدفع:', 'Payment:')} {isPaid ? tr('مدفوع', 'Paid') : tr('باقي', 'Pending')}
                      </span>
                      <span className="text-slate-500">
                        {tr('الإجراء:', 'Procedure:')} {isDone ? tr('تم الصرف', 'Dispensed') : tr('باقي', 'Pending')}
                      </span>
                    </div>
                    <div className="text-sm text-slate-500 mt-1 space-x-3 rtl:space-x-reverse">
                      {(meta.dose || med.dose) && <span>{tr('الجرعة', 'Dose')}: {meta.dose || med.dose}</span>}
                      {(meta.frequency || med.frequency) && <span>{tr('التكرار', 'Frequency')}: {meta.frequency || med.frequency}</span>}
                      {(meta.route || med.route) && <span>{tr('الطريقة', 'Route')}: {meta.route || med.route}</span>}
                      {(meta.duration || med.duration) && <span>{tr('المدة', 'Duration')}: {meta.duration || med.duration}</span>}
                    </div>
                    {(meta.instructions || med.instructions) && (
                      <div className="text-xs text-slate-400 mt-1">{meta.instructions || med.instructions}</div>
                    )}
                  </div>
                  {(isDone || statusKey === 'COMPLETED') && (
                    <Link
                      href={`/opd/visit/${visitId}/results`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 shrink-0"
                    >
                      <BarChart3 className="h-3.5 w-3.5 inline-block" /> {tr('عرض النتائج', 'View Results')}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-slate-500 text-center py-8">{tr('لا يوجد وصفات بعد', 'No prescriptions yet')}</div>
        )}
      </div>

      {/* PrescriptionDialog - fully featured with drug interactions, allergy checks, etc. */}
      <PrescriptionDialog
        encounterCoreId={String(visitId || '')}
        allergies={allergies}
        open={showPrescription}
        onOpenChange={setShowPrescription}
        onSuccess={() => {
          setShowPrescription(false);
          mutate();
          toast({ title: tr('تم حفظ الوصفة بنجاح', 'Prescription saved successfully') });
        }}
      />
    </div>
  );
}
