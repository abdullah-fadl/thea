'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { FlaskConical, Radio, Pill, CalendarDays, RefreshCcw, Wrench, Target, Phone, CheckCircle2, X, CircleDot, Calendar } from 'lucide-react';
import { type ReactNode } from 'react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const GAP_TYPE_CONFIG: Record<string, { label: string; labelAr: string; icon: ReactNode; color: string }> = {
  LAB_OVERDUE: {
    label: 'Lab Overdue',
    labelAr: 'تحليل متأخر',
    icon: <FlaskConical className="w-3.5 h-3.5 inline-block" />,
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  },
  RAD_OVERDUE: {
    label: 'Radiology Overdue',
    labelAr: 'أشعة متأخرة',
    icon: <Radio className="w-3.5 h-3.5 inline-block" />,
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200',
  },
  MEDICATION_MISSED: {
    label: 'Medication Missed',
    labelAr: 'دواء فائت',
    icon: <Pill className="w-3.5 h-3.5 inline-block" />,
    color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
  },
  FOLLOWUP_MISSED: {
    label: 'Follow-up Missed',
    labelAr: 'متابعة فائتة',
    icon: <CalendarDays className="w-3.5 h-3.5 inline-block" />,
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
  },
  REFERRAL_PENDING: {
    label: 'Referral Pending',
    labelAr: 'تحويل معلق',
    icon: <RefreshCcw className="w-3.5 h-3.5 inline-block" />,
    color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200',
  },
  PROCEDURE_OVERDUE: {
    label: 'Procedure Overdue',
    labelAr: 'إجراء متأخر',
    icon: <Wrench className="w-3.5 h-3.5 inline-block" />,
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200',
  },
};

const STATUS_CONFIG: Record<string, { label: string; labelAr: string; color: string }> = {
  OPEN: { label: 'Open', labelAr: 'مفتوح', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200' },
  CONTACTED: { label: 'Contacted', labelAr: 'تم التواصل', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' },
  SCHEDULED: { label: 'Scheduled', labelAr: 'مجدول', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200' },
  RESOLVED: { label: 'Resolved', labelAr: 'تم الحل', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' },
  DISMISSED: { label: 'Dismissed', labelAr: 'مرفوض', color: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300' },
};

interface Props {
  visitId: string;
  patientId?: string;
}

export default function CareGapsPanel({ visitId, patientId }: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();
  const [showOutreach, setShowOutreach] = useState<string | null>(null);

  // First resolve the patientId from the encounter if not provided
  const { data: encounterData } = useSWR(
    !patientId && visitId ? `/api/opd/encounters/${visitId}/summary` : null,
    fetcher
  );

  const resolvedPatientId = patientId || encounterData?.encounter?.patientMasterId;

  // Fetch care gaps for this patient
  const { data, isLoading, mutate } = useSWR(
    resolvedPatientId ? `/api/care-gaps?patientId=${resolvedPatientId}&status=OPEN` : null,
    fetcher
  );

  // Fetch stats for this patient
  const { data: statsData } = useSWR(
    resolvedPatientId ? `/api/care-gaps/stats?patientId=${resolvedPatientId}` : null,
    fetcher
  );

  const gaps = data?.items || [];
  const stats = statsData?.summary || {};

  const handleStatusUpdate = useCallback(
    async (gapId: string, newStatus: string) => {
      try {
        const res = await fetch(`/api/care-gaps/${gapId}`, {
          credentials: 'include',
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: newStatus,
            ...(newStatus === 'RESOLVED' && { resolvedReason: 'Resolved by doctor' }),
            ...(newStatus === 'DISMISSED' && { dismissedReason: 'Dismissed by doctor' }),
          }),
        });
        if (!res.ok) throw new Error('Failed');
        toast({ title: tr('تم التحديث', 'Updated') });
        mutate();
      } catch {
        toast({ title: tr('فشل', 'Failed'), variant: 'destructive' as const });
      }
    },
    [mutate, toast, tr]
  );

  const handleOutreach = useCallback(
    async (gapId: string, type: string, notes: string, outcome?: string) => {
      try {
        const res = await fetch(`/api/care-gaps/${gapId}/outreach`, {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outreachType: type, message: notes, outcome }),
        });
        if (!res.ok) throw new Error('Failed');
        toast({ title: tr('تم تسجيل التواصل', 'Outreach logged') });
        setShowOutreach(null);
        mutate();
      } catch {
        toast({ title: tr('فشل', 'Failed'), variant: 'destructive' as const });
      }
    },
    [mutate, toast, tr]
  );

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="text-center py-8 text-muted-foreground">
          {tr('جاري التحميل...', 'Loading...')}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <Target className="w-4 h-4 inline-block" /> {tr('فجوات الرعاية', 'Care Gaps')}
        {stats.totalActive > 0 && (
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200">
            {stats.totalActive}
          </span>
        )}
      </h2>

      {/* Summary bar */}
      {stats.totalActive > 0 && (
        <div className="flex flex-wrap gap-3 mb-4 px-3 py-2 bg-muted/50 rounded-xl">
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <CircleDot className="w-3 h-3 text-red-500" /> {stats.totalOpen || 0} {tr('مفتوح', 'open')}
          </span>
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Phone className="w-3 h-3" /> {stats.totalContacted || 0} {tr('تم التواصل', 'contacted')}
          </span>
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {stats.totalScheduled || 0} {tr('مجدول', 'scheduled')}
          </span>
        </div>
      )}

      {gaps.length > 0 ? (
        <div className="space-y-3">
          {gaps.map((gap: any) => {
            const typeCfg = GAP_TYPE_CONFIG[gap.gapType] || GAP_TYPE_CONFIG.LAB_OVERDUE;
            const statusCfg = STATUS_CONFIG[gap.status] || STATUS_CONFIG.OPEN;

            return (
              <div
                key={gap.id}
                className="p-4 rounded-xl border border-border"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Badges */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                        {language === 'ar' ? statusCfg.labelAr : statusCfg.label}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${typeCfg.color}`}>
                        {typeCfg.icon} {language === 'ar' ? typeCfg.labelAr : typeCfg.label}
                      </span>
                      {gap.priority !== 'ROUTINE' && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          gap.priority === 'STAT'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
                        }`}>
                          {gap.priority === 'STAT'
                            ? tr('طارئ', 'STAT')
                            : tr('عاجل', 'Urgent')}
                        </span>
                      )}
                    </div>

                    {/* Order name */}
                    <p className="font-medium text-foreground">
                      {language === 'ar'
                        ? gap.sourceOrderNameAr || gap.sourceOrderName || tr('غير محدد', 'Unspecified')
                        : gap.sourceOrderName || tr('غير محدد', 'Unspecified')}
                    </p>

                    {/* Reason */}
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {language === 'ar' ? gap.reasonAr || gap.reason : gap.reason}
                    </p>

                    {/* Outreach info */}
                    {gap.outreachCount > 0 && (
                      <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {gap.outreachCount} {tr('محاولة تواصل', 'outreach attempt(s)')}
                      </p>
                    )}

                    {/* Date */}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(gap.detectedAt).toLocaleString(
                        language === 'ar' ? 'ar-SA' : 'en-GB',
                        { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                      )}
                    </p>
                  </div>

                  {/* Quick actions */}
                  {gap.status !== 'RESOLVED' && gap.status !== 'DISMISSED' && (
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => setShowOutreach(gap.id)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 thea-transition-fast"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(gap.id, 'RESOLVED')}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 hover:bg-emerald-100 thea-transition-fast"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(gap.id, 'DISMISSED')}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-100 thea-transition-fast"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p>{tr('لا توجد فجوات رعائية لهذا المريض', 'No care gaps for this patient')}</p>
          <p className="text-sm mt-1">
            {tr('جميع الطلبات والمتابعات مُنجزة', 'All orders and follow-ups are completed')}
          </p>
        </div>
      )}

      {/* Inline Outreach Dialog */}
      {showOutreach && (
        <InlineOutreachDialog
          gapId={showOutreach}
          onClose={() => setShowOutreach(null)}
          onSubmit={handleOutreach}
          language={language}
        />
      )}
    </div>
  );
}

function InlineOutreachDialog({
  gapId,
  onClose,
  onSubmit,
  language,
}: {
  gapId: string;
  onClose: () => void;
  onSubmit: (gapId: string, type: string, notes: string, outcome?: string) => void;
  language: string;
}) {
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [type, setType] = useState('CALL');
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('');

  return (
    <div className="mt-4 p-4 rounded-xl border border-primary/30 bg-primary/5">
      <h4 className="text-sm font-bold text-foreground mb-3">
        <Phone className="w-3.5 h-3.5 inline-block" /> {tr('تسجيل تواصل', 'Log Outreach')}
      </h4>

      <div className="flex gap-1.5 mb-3">
        {['CALL', 'SMS', 'WHATSAPP', 'EMAIL'].map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold thea-transition-fast ${
              type === t
                ? 'bg-primary text-white'
                : 'bg-card border border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="w-full rounded-xl border border-border bg-card p-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30 focus:border-primary mb-3"
        placeholder={tr('ملاحظات...', 'Notes...')}
      />

      <select
        value={outcome}
        onChange={(e) => setOutcome(e.target.value)}
        className="w-full rounded-xl border border-border bg-card p-2 text-sm text-foreground mb-3"
      >
        <option value="">{tr('النتيجة', 'Outcome')}</option>
        <option value="PATIENT_WILL_COME">{tr('سيحضر', 'Will come')}</option>
        <option value="RESCHEDULED">{tr('تم الجدولة', 'Rescheduled')}</option>
        <option value="PATIENT_REFUSED">{tr('رفض', 'Refused')}</option>
        <option value="NO_ANSWER">{tr('لا رد', 'No answer')}</option>
      </select>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-muted text-muted-foreground hover:bg-muted/80 thea-transition-fast"
        >
          {tr('إلغاء', 'Cancel')}
        </button>
        <button
          onClick={() => onSubmit(gapId, type, notes, outcome || undefined)}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary/90 thea-transition-fast"
        >
          {tr('تسجيل', 'Log')}
        </button>
      </div>
    </div>
  );
}
