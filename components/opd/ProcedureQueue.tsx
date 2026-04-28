'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import {
  Syringe,
  Clock,
  CheckCircle2,
  User,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Stethoscope,
  Timer,
} from 'lucide-react';
import { getAge, formatGender } from '@/lib/opd/ui-helpers';
import { ProcedureDetailPanel } from './ProcedureDetailPanel';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

// ── Props ────────────────────────────────────────────────────────────────────

interface ProcedureQueueProps {
  clinicId: string;
  date: string;
  onRefresh?: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ProcedureQueue({ clinicId, date, onRefresh }: ProcedureQueueProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const params = new URLSearchParams();
  params.set('date', date);
  if (clinicId && clinicId !== 'ALL') params.set('clinicId', clinicId);

  const { data, mutate, isLoading } = useSWR(
    `/api/opd/nursing/procedure-queue?${params.toString()}`,
    fetcher,
    { refreshInterval: 15000 }
  );
  const items: any[] = data?.items || [];

  // ── Stats ───────────────────────────────────────────────────────────────
  const pendingCount = items.filter((i) => i.opdFlowState === 'PROCEDURE_PENDING').length;
  const inProgressCount = items.filter(
    (i) => i.opdFlowState === 'PROCEDURE_PENDING' && i.procedureStartAt
  ).length;
  const doneCount = items.filter((i) => i.opdFlowState === 'PROCEDURE_DONE_WAITING').length;

  const handleRefresh = useCallback(() => {
    mutate();
    onRefresh?.();
  }, [mutate, onRefresh]);

  const handleDetailComplete = useCallback(() => {
    setSelectedItem(null);
    mutate();
  }, [mutate]);

  // ── Render ──────────────────────────────────────────────────────────────

  // If a patient is selected, show the detail panel
  if (selectedItem) {
    return (
      <ProcedureDetailPanel
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onComplete={handleDetailComplete}
      />
    );
  }

  return (
    <div>
      {/* ── KPI Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl">
              <Timer className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">
                {tr('بانتظار الإجراء', 'Pending Procedure')}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Syringe className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{inProgressCount}</p>
              <p className="text-xs text-muted-foreground">
                {tr('قيد التنفيذ', 'In Progress')}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{doneCount}</p>
              <p className="text-xs text-muted-foreground">
                {tr('مكتمل - بانتظار الطبيب', 'Done - Waiting Doctor')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Refresh ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Syringe className="w-5 h-5 text-green-600" />
          {tr('قائمة الإجراءات', 'Procedure Queue')}
          <span className="text-sm text-muted-foreground font-normal">({items.length})</span>
        </h3>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-xl hover:bg-muted text-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          {tr('تحديث', 'Refresh')}
        </button>
      </div>

      {/* ── Empty State ───────────────────────────────────────────────── */}
      {items.length === 0 && !isLoading ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">
            {tr('لا توجد إجراءات معلقة', 'No pending procedures')}
          </h3>
          <p className="text-muted-foreground">
            {tr(
              'لا يوجد مرضى ينتظرون إجراءات حالياً',
              'No patients are waiting for procedures at this time'
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isPending = item.opdFlowState === 'PROCEDURE_PENDING';
            const isStarted = isPending && item.procedureStartAt;
            const isDone = item.opdFlowState === 'PROCEDURE_DONE_WAITING';

            const statusConfig = isDone
              ? {
                  label: tr('مكتمل', 'Completed'),
                  bg: 'bg-emerald-100',
                  text: 'text-emerald-700',
                  border: 'border-emerald-200',
                  pulse: false,
                }
              : isStarted
                ? {
                    label: tr('قيد التنفيذ', 'In Progress'),
                    bg: 'bg-blue-100',
                    text: 'text-blue-700',
                    border: 'border-blue-200',
                    pulse: true,
                  }
                : {
                    label: tr('بانتظار الإجراء', 'Pending'),
                    bg: 'bg-amber-100',
                    text: 'text-amber-700',
                    border: 'border-amber-200',
                    pulse: false,
                  };

            const procedureNames = (item.procedures || [])
              .map((p: any) =>
                language === 'ar' ? p.orderNameAr || p.orderName : p.orderName
              )
              .join(', ');

            return (
              <button
                key={item.encounterCoreId}
                onClick={() => setSelectedItem(item)}
                className="w-full bg-card rounded-2xl border border-border p-4 hover:bg-muted/50 transition-colors text-start"
              >
                <div className="flex items-center gap-4">
                  {/* Patient avatar */}
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                    <Syringe className="w-6 h-6 text-green-600" />
                  </div>

                  {/* Patient info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-foreground truncate">
                        {item.patient?.fullName || tr('مريض', 'Patient')}
                      </p>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border} border`}
                      >
                        {statusConfig.pulse && (
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse mr-1.5" />
                        )}
                        {statusConfig.label}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {tr('ملف', 'MRN')}: {item.patient?.mrn || '—'}
                      {item.patient?.dob && ` • ${getAge(item.patient.dob)}`}
                      {item.patient?.gender &&
                        ` • ${formatGender(item.patient.gender)}`}
                    </p>

                    {procedureNames && (
                      <p className="text-sm text-foreground mt-1 flex items-center gap-1.5">
                        <Syringe className="w-3.5 h-3.5 text-green-600 shrink-0" />
                        {procedureNames}
                      </p>
                    )}

                    {item.doctorName && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Stethoscope className="w-3 h-3" />
                        {item.doctorName}
                        {item.clinicName && ` • ${item.clinicName}`}
                      </p>
                    )}
                  </div>

                  {/* Wait time + arrow */}
                  <div className="flex items-center gap-3 shrink-0">
                    {item.waitingSinceMinutes > 0 && (
                      <div className="text-center">
                        <p
                          className={`text-lg font-bold ${
                            item.waitingSinceMinutes > 30
                              ? 'text-red-600'
                              : item.waitingSinceMinutes > 15
                                ? 'text-amber-600'
                                : 'text-muted-foreground'
                          }`}
                        >
                          {item.waitingSinceMinutes}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{tr('دقيقة', 'min')}</p>
                      </div>
                    )}
                    <ChevronRight className="w-5 h-5 text-muted-foreground rtl:rotate-180" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
