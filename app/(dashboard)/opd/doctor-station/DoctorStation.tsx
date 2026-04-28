'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import {
  CalendarDays,
  RefreshCw,
  Search,
  Clock,
  Users,
  CheckCircle2,
  Flag,
  AlertTriangle,
  XCircle,
  ClipboardList,
  PauseCircle,
  Stethoscope,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-modal';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useOpdEvents } from '@/hooks/useOpdEvents';
import { getAge, formatGender, formatDateLabel, formatWait, getWaitColor, parseSystolic, formatTime, addDaysToDateString } from '@/lib/opd/ui-helpers';
import { OPD_STATUS_CONFIG, DEFAULT_STATUS, VISIT_TYPE_CONFIG, DOCTOR_TABS } from '@/lib/opd/ui-config';
import { ConsentForm, type ConsentData } from '@/components/consent/ConsentForm';
import { CONSENT_TYPES } from '@/lib/clinical/consentTypes';
import { TheaKpiCard, TheaPatientRow, TheaTab, TheaInput, TheaStatusBadge } from '@/components/thea-ui';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const OverviewPanel = dynamic(() => import('@/components/opd/panels/OverviewPanel'), { ssr: false });
const SoapPanel = dynamic(() => import('@/components/opd/panels/SoapPanel'), { ssr: false });
const OrdersPanel = dynamic(() => import('@/components/opd/panels/OrdersPanel'), { ssr: false });
const PrescriptionPanel = dynamic(() => import('@/components/opd/panels/PrescriptionPanel'), { ssr: false });
const SmartVisitReport = dynamic(() => import('@/components/opd/SmartVisitReport'), { ssr: false });
const ResultsPanel = dynamic(() => import('@/components/opd/panels/ResultsPanel'), { ssr: false });
const DischargePanel = dynamic(() => import('@/components/opd/panels/DischargePanel'), { ssr: false });
const DiagnosisPanel = dynamic(() => import('@/components/opd/panels/DiagnosisPanel'), { ssr: false });
const ReferralsPanel = dynamic(() => import('@/components/opd/panels/ReferralsPanel'), { ssr: false });
const CareGapsPanel = dynamic(() => import('@/components/opd/panels/CareGapsPanel'), { ssr: false });
const SmartReferralDialog = dynamic(() => import('@/components/clinical/SmartReferralDialog'), { ssr: false });
const DentalPanel = dynamic(() => import('@/components/opd/panels/DentalPanel'), { ssr: false });

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

/* ══════════════════════════════════════════════════════════════
   محطة الطبيب – Doctor Station (Thea UI Design)
   ══════════════════════════════════════════════════════════════ */
export default function DoctorStation() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();
  const { confirm: showConfirm } = useConfirm();
  const router = useRouter();
  const { hasPermission, isLoading } = useRoutePermission('/opd/doctor-station');

  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
  const [selectedDate, setSelectedDate] = useState(today);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshCountdown, setRefreshCountdown] = useState(15);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');
  // C1: Consent
  const [showConsentForm, setShowConsentForm] = useState(false);
  const [consentType, setConsentType] = useState('general_treatment');
  // C2: Smart Referral
  const [showReferralDialog, setShowReferralDialog] = useState(false);

  const isToday = selectedDate === today;
  const isPast = selectedDate < today;

  /* ── Auto-refresh countdown ── */
  useEffect(() => {
    if (!autoRefresh || !isToday) return;
    const interval = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) return 15;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, isToday]);

  /* ── SWR data fetch ── */
  const { data, mutate, isValidating } = useSWR(
    hasPermission ? `/api/opd/doctor/schedule?date=${selectedDate}` : null,
    fetcher,
    { refreshInterval: autoRefresh && isToday ? 15000 : 0, keepPreviousData: true }
  );

  /* ── Date navigation ── */
  const navigateDate = useCallback(
    (dir: number) => {
      const ns = addDaysToDateString(selectedDate, dir);
      if (ns > today) return;
      setSelectedDate(ns);
    },
    [selectedDate, today]
  );

  useEffect(() => {
    if (isPast) setAutoRefresh(false);
    setRefreshCountdown(15);
  }, [isPast, selectedDate]);

  /* ── SSE live updates ── */
  useOpdEvents(
    useCallback((event: any) => {
      if (['FLOW_STATE_CHANGE', 'NEW_PATIENT', 'VITALS_SAVED'].includes(event.type)) {
        mutate();
      }
    }, [mutate]),
    !!data && isToday
  );

  /* ── Data processing ── */
  const rawItems = Array.isArray(data?.items) ? data.items : [];
  const items = rawItems
    .filter((item: any) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return item.patient?.fullName?.toLowerCase().includes(q) || item.patient?.mrn?.toLowerCase().includes(q);
    })
    .sort((a: any, b: any) => {
      const pa = (OPD_STATUS_CONFIG[a.opdFlowState] || DEFAULT_STATUS).priority;
      const pb = (OPD_STATUS_CONFIG[b.opdFlowState] || DEFAULT_STATUS).priority;
      if (pa !== pb) return pa - pb;
      return (b.waitingToDoctorMinutes || 0) - (a.waitingToDoctorMinutes || 0);
    });

  const ready = items.filter((i: any) => i.opdFlowState === 'READY_FOR_DOCTOR').length;
  const inConsult = items.filter((i: any) => i.opdFlowState === 'IN_DOCTOR').length;
  const waiting = items.filter((i: any) => ['WAITING_DOCTOR', 'PROCEDURE_DONE_WAITING'].includes(i.opdFlowState)).length;
  const completed = items.filter((i: any) => i.opdFlowState === 'COMPLETED').length;
  const doctorName = data?.doctor?.displayName || 'طبيب';
  const reason = data?.reason;

  // C1: Selected item for consent
  const selectedItem = selectedEncounterId ? items.find((i: any) => i.encounterCoreId === selectedEncounterId) : null;

  // Doctor must "Receive patient" before accessing clinical tabs
  const DOCTOR_ACTIVE_STATES = ['IN_DOCTOR', 'PROCEDURE_PENDING', 'PROCEDURE_DONE_WAITING', 'COMPLETED'];
  const isDoctorActive = selectedItem ? DOCTOR_ACTIVE_STATES.includes(selectedItem.opdFlowState) : false;
  const isDentalSpecialty = ['dental', 'dentistry', 'dentist', 'أسنان'].some(
    (s) => (selectedItem?.specialtyCode || '').toLowerCase().includes(s)
  );

  // C3: Care Gaps — fetch open gap count for the selected patient (must be before any early return)
  const selectedPatientId = selectedItem?.patient?.id || selectedItem?.patientMasterId || null;
  const { data: careGapStats } = useSWR(
    selectedPatientId ? `/api/care-gaps/stats?patientId=${selectedPatientId}` : null,
    fetcher
  );
  const careGapCount = careGapStats?.summary?.totalActive || 0;

  /* ── Permission gate (after all hooks) ── */
  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  // C1: Handle consent completion
  const handleConsentComplete = async (consentData: ConsentData) => {
    try {
      await fetch('/api/clinical/consents', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...consentData,
          encounterId: selectedEncounterId,
          patientId: selectedItem?.patient?.id || selectedItem?.patientMasterId,
        }),
      });
      toast({ title: language === 'ar' ? 'تم حفظ الموافقة' : 'Consent saved' });
      setShowConsentForm(false);
    } catch {
      toast({ title: language === 'ar' ? 'فشل حفظ الموافقة' : 'Failed to save consent', variant: 'destructive' as const });
    }
  };

  /* ── Actions ── */
  const runPtSeen = async (row: any) => {
    if (!row?.encounterCoreId) return;
    try {
      const flowRes = await fetch(`/api/opd/encounters/${row.encounterCoreId}/flow-state`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opdFlowState: 'IN_DOCTOR' }),
      });
      const flowPayload = await flowRes.json().catch(() => ({}));
      if (!flowRes.ok) throw new Error(flowPayload.error || tr('فشل تحديث الحالة', 'Failed to update state'));

      const tsRes = await fetch(`/api/opd/encounters/${row.encounterCoreId}/timestamps`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opdTimestamps: { doctorStartAt: new Date().toISOString() } }),
      });
      const tsPayload = await tsRes.json().catch(() => ({}));
      if (!tsRes.ok && tsRes.status !== 409) {
        throw new Error(tsPayload.error || tr('فشل تسجيل بداية الكشف', 'Failed to record visit start'));
      }
      toast({ title: tsRes.status === 409 ? tr('بدأت الزيارة مسبقاً', 'Visit already started') : tr('تم استقبال المريض', 'Patient received') });
      mutate();
      setSelectedEncounterId(row.encounterCoreId);
      setActiveTab('overview');
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    }
  };

  /* Send patient to procedures/labs and wait for results */
  const runSendToProcedures = async () => {
    if (!selectedEncounterId) return;
    try {
      const res = await fetch(`/api/opd/encounters/${selectedEncounterId}/flow-state`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opdFlowState: 'PROCEDURE_PENDING' }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || tr('فشل تحديث الحالة', 'Failed to update state'));
      toast({ title: tr('تم إرسال المريض للفحوصات', 'Patient sent for procedures') });
      mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message, variant: 'destructive' as const });
    }
  };

  /* Complete visit — set flow state to COMPLETED and booking to COMPLETED */
  const runCompleteVisit = async (acknowledgeOpenOrders = false) => {
    if (!selectedEncounterId || !selectedItem) return;
    if (!acknowledgeOpenOrders) {
      const confirmed = await showConfirm(
        tr('هل تريد إنهاء هذه الزيارة وإرسال المريض للمنزل؟', 'Complete this visit and send the patient home?')
      );
      if (!confirmed) return;
    }
    try {
      const flowRes = await fetch(`/api/opd/encounters/${selectedEncounterId}/flow-state`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opdFlowState: 'COMPLETED', acknowledgeOpenOrders }),
      });
      const flowPayload = await flowRes.json().catch(() => ({}));

      if (!flowRes.ok) {
        if (flowPayload.error === 'PENDING_ORDERS_WARNING' && flowPayload.requiresAcknowledgement) {
          const msg = language === 'ar' ? flowPayload.message : flowPayload.messageEn;
          const proceed = await showConfirm(
            `${msg}\n\n${tr('المريض سيتوجه للاستقبال لتسديد رسوم الطلبات.', 'The patient will be routed to reception to pay for pending orders.')}`
          );
          if (proceed) return runCompleteVisit(true);
          return;
        }
        throw new Error(flowPayload.messageEn || flowPayload.error || tr('فشل إنهاء الزيارة', 'Failed to complete visit'));
      }

      await fetch(`/api/opd/encounters/${selectedEncounterId}/timestamps`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opdTimestamps: { doctorEndAt: new Date().toISOString() } }),
      });

      toast({ title: tr('تم إنهاء الزيارة بنجاح', 'Visit completed successfully') });
      mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message, variant: 'destructive' as const });
    }
  };

  /* Mark patient as returned from procedures → back to IN_DOCTOR */
  const runPatientReturned = async () => {
    if (!selectedEncounterId) return;
    try {
      const res = await fetch(`/api/opd/encounters/${selectedEncounterId}/flow-state`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opdFlowState: 'IN_DOCTOR' }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || tr('فشل تحديث الحالة', 'Failed to update state'));
      toast({ title: tr('رجع المريض — أكمل الكشف', 'Patient returned — continue examination') });
      mutate();
      setActiveTab('results');
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message, variant: 'destructive' as const });
    }
  };

  /* ── Calendar grid ── */
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDow = new Date(calYear, calMonth, 1).getDay();
  const prevMonthDays = new Date(calYear, calMonth, 0).getDate();
  const calDays: Array<{ d: number; curr: boolean; future?: boolean; dateStr?: string }> = [];
  for (let i = firstDow - 1; i >= 0; i--) calDays.push({ d: prevMonthDays - i, curr: false });
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calDays.push({ d, curr: true, future: ds > today, dateStr: ds });
  }
  const rem = 7 - (calDays.length % 7);
  if (rem < 7) for (let d = 1; d <= rem; d++) calDays.push({ d, curr: false });

  /* ══════════════════════════════════════════════════════════════
     JSX — Thea UI Design
     ══════════════════════════════════════════════════════════════ */
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-5 md:space-y-6 thea-animate-fade-in">
      {/* ── Toolbar: Date Nav + LIVE + Search ── */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-4">
        {/* Left: Date nav + LIVE + Refresh */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {/* Date picker with Popover (portals to body — no overflow clipping) */}
          <div className="flex items-center bg-muted/50 rounded-xl border border-border">
            <button
              onClick={() => navigateDate(-1)}
              className="px-2.5 py-2 hover:bg-muted rounded-s-xl text-muted-foreground thea-transition-fast"
            >
              ◀
            </button>
            <Popover open={showCalendar} onOpenChange={setShowCalendar}>
              <PopoverTrigger asChild>
                <button
                  className="px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted thea-transition-fast flex items-center gap-1.5 rounded-none"
                >
                  <CalendarDays className="h-4 w-4 inline-block" /> {isToday ? tr('اليوم', 'Today') : formatDateLabel(selectedDate, language)}
                </button>
              </PopoverTrigger>
              <PopoverContent
                align={isRTL ? 'end' : 'start'}
                side="bottom"
                sideOffset={8}
                className="w-80 p-4 rounded-2xl shadow-xl border-border thea-animate-slide-up"
              >
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => {
                      if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
                      else setCalMonth(calMonth - 1);
                    }}
                    className="p-1.5 hover:bg-muted rounded-xl text-muted-foreground thea-transition-fast"
                  >
                    ◀
                  </button>
                  <span className="text-sm font-bold text-foreground">
                    {new Date(calYear, calMonth).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'long' })} {calYear}
                  </span>
                  <button
                    onClick={() => {
                      const nextMonth = calMonth === 11 ? 0 : calMonth + 1;
                      const nextYear = calMonth === 11 ? calYear + 1 : calYear;
                      const firstOfNext = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01`;
                      if (firstOfNext > today) return;
                      if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
                      else setCalMonth(calMonth + 1);
                    }}
                    className="p-1.5 hover:bg-muted rounded-xl text-muted-foreground thea-transition-fast"
                  >
                    ▶
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center mb-1">
                  {(language === 'ar'
                    ? ['أح', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب']
                    : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
                  ).map((d) => (
                    <div key={d} className="text-[10px] font-medium text-muted-foreground py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calDays.map((day, i) => {
                    const isSel = day.dateStr === selectedDate;
                    const isTod = day.dateStr === today;
                    const disabled = !day.curr || day.future;
                    return (
                      <button
                        key={i}
                        disabled={disabled}
                        onClick={() => {
                          if (!day.dateStr) return;
                          setSelectedDate(day.dateStr);
                          setShowCalendar(false);
                        }}
                        className={`h-8 w-8 rounded-xl text-xs flex items-center justify-center relative thea-transition-fast
                          ${disabled ? 'text-muted-foreground/30 cursor-not-allowed' : 'hover:bg-primary/10 cursor-pointer'}
                          ${!day.curr ? 'text-muted-foreground/30' : 'text-foreground'}
                          ${isSel ? 'bg-primary text-white font-bold hover:bg-primary/90' : ''}
                          ${isTod && !isSel ? 'ring-2 ring-primary/40 font-semibold' : ''}`}
                      >
                        {day.d}
                        {isTod && <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary" />}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                  <button
                    onClick={() => { setSelectedDate(today); setShowCalendar(false); }}
                    className="flex-1 text-xs py-1.5 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 font-semibold thea-transition-fast"
                  >
                    {tr('اليوم', 'Today')}
                  </button>
                  <button
                    onClick={() => {
                      const y = new Date(`${today}T00:00:00`);
                      y.setDate(y.getDate() - 1);
                      setSelectedDate(y.toISOString().slice(0, 10));
                      setShowCalendar(false);
                    }}
                    className="flex-1 text-xs py-1.5 bg-muted/50 text-muted-foreground rounded-xl hover:bg-muted font-medium thea-transition-fast"
                  >
                    {tr('أمس', 'Yesterday')}
                  </button>
                </div>
              </PopoverContent>
            </Popover>
            <button
              onClick={() => navigateDate(1)}
              className="px-2.5 py-2 hover:bg-muted rounded-e-xl text-muted-foreground thea-transition-fast disabled:opacity-30"
              disabled={selectedDate >= today}
            >
              ▶
            </button>
          </div>

          {/* LIVE indicator */}
          {isToday && (
            <button
              onClick={() => { setAutoRefresh(!autoRefresh); if (!autoRefresh) setRefreshCountdown(15); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold thea-transition-fast border shrink-0 ${
                autoRefresh
                  ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-muted/50 text-muted-foreground border-border'
              }`}
            >
              <span className="relative flex h-2 w-2">
                {autoRefresh && <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                <span className={`relative rounded-full h-2 w-2 ${autoRefresh ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
              </span>
              {autoRefresh ? `LIVE · ${refreshCountdown}s` : tr('متوقف', 'PAUSED')}
            </button>
          )}

          <button
            onClick={() => { setRefreshCountdown(15); mutate(); }}
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground thea-transition-fast shrink-0"
            title={tr('تحديث الآن', 'Refresh now')}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Right: Search */}
        <TheaInput
          placeholder={tr('ابحث بالاسم أو رقم الملف...', 'Search by name or MRN...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search className="h-4 w-4 text-muted-foreground" />}
          className="w-full sm:w-72"
        />
      </div>

      {/* ── Past-date warning ── */}
      {isPast && (
        <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <span className="text-sm text-amber-800 dark:text-amber-200">
              {tr('عرض بيانات تاريخية ليوم', 'Showing historical data for')} <strong>{formatDateLabel(selectedDate, language)}</strong> — {tr('الإجراءات معطّلة', 'actions are disabled')}.
            </span>
          </div>
          <button
            onClick={() => setSelectedDate(today)}
            className="text-xs bg-amber-100 dark:bg-amber-900 hover:bg-amber-200 dark:hover:bg-amber-800 text-amber-800 dark:text-amber-200 px-3 py-1.5 rounded-xl font-semibold thea-transition-fast"
          >
            {tr('العودة لليوم', 'Back to today')}
          </button>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <TheaKpiCard icon={<Users className="h-5 w-5 text-foreground" />} label={tr('الإجمالي', 'Total')} value={items.length} />
        <TheaKpiCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />} label={tr('جاهز', 'Ready')} value={ready} color="#059669" />
        <TheaKpiCard icon={<Clock className="h-5 w-5 text-amber-600" />} label={tr('ينتظر', 'Waiting')} value={waiting} color="#D97706" />
        <TheaKpiCard icon={<Flag className="h-5 w-5 text-blue-700" />} label={tr('مكتمل', 'Completed')} value={completed} color="#1D4ED8" />
      </div>

      {/* ── Error States ── */}
      {reason === 'NO_STAFF_ID' && (
        <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900 flex items-center justify-center flex-shrink-0"><AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" /></div>
            <div>
              <h3 className="font-bold text-amber-800 dark:text-amber-200 mb-1">{tr('حسابك غير مرتبط بطبيب', 'Your account is not linked to a doctor')}</h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">{tr('معرّف الموظف مفقود من حسابك. يرجى التواصل مع مسؤول النظام.', 'Staff ID is missing from your account. Please contact administrator.')}</p>
              <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 rounded-xl p-3">
                <strong>{tr('المسؤول', 'Admin')}:</strong> {tr('اذهب إلى الإدارة → المستخدمين → اختر هذا المستخدم → حدّد معرّف الموظف ليطابق مقدمي الخدمة.', 'Go to Admin → Users → select this user → set Staff ID to match provider records.')}
              </div>
            </div>
          </div>
        </div>
      )}

      {reason === 'NO_PROVIDER' && (
        <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900 flex items-center justify-center flex-shrink-0"><XCircle className="h-5 w-5 text-red-600 dark:text-red-400" /></div>
            <div>
              <h3 className="font-bold text-red-800 dark:text-red-200 mb-1">{tr('لم يتم العثور على معرّف الموظف في مقدمي الخدمة', 'Staff ID not found in providers')}</h3>
              <p className="text-sm text-red-700 dark:text-red-300 mb-2">{tr('معرّف الموظف في حسابك لا يطابق أي سجل طبيب.', 'Your account Staff ID does not match any doctor record.')}</p>
              <div className="text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50 rounded-xl p-3">
                <strong>{tr('المسؤول', 'Admin')}:</strong> {tr('تأكد من تطابق معرّف الموظف في الإدارة → المستخدمين والإدارة → البنية السريرية → مقدمي الخدمة.', 'Ensure Staff ID matches in Admin → Users and Admin → Clinical Infrastructure → Providers.')}
              </div>
            </div>
          </div>
        </div>
      )}

      {reason === 'NO_RESOURCES' && (
        <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0"><CalendarDays className="h-5 w-5 text-blue-600 dark:text-blue-400" /></div>
            <div>
              <h3 className="font-bold text-blue-800 dark:text-blue-200 mb-1">{tr('لم يتم إعداد الجدول', 'Schedule not configured')}</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">{tr('سجل مقدم الخدمة مرتبط، لكن لا توجد موارد جدولة بعد.', 'Provider record is linked, but no scheduling resources exist yet.')}</p>
              <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 rounded-xl p-3">
                <strong>{tr('المسؤول', 'Admin')}:</strong> {tr('اذهب إلى الجدولة → الموارد وأنشئ مورد مقدم خدمة، ثم أنشئ القوالب وولّد الفترات.', 'Go to Scheduling → Resources and create a provider resource, then create templates and generate slots.')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
           SPLIT VIEW — Patient selected
         ══════════════════════════════════════════════════════ */}
      {selectedEncounterId ? (
        <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: 'calc(100vh - 300px)' }}>
          {/* ── Left: Compact Patient List ── */}
          <div className="w-full lg:w-[280px] shrink-0 bg-card rounded-2xl border border-border overflow-hidden flex flex-col max-h-[40vh] lg:max-h-none">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">{tr('المرضى', 'Patients')} ({items.length})</span>
              <button
                onClick={() => { setSelectedEncounterId(null); setActiveTab('overview'); }}
                className="text-xs text-primary hover:text-primary/80 font-semibold thea-transition-fast"
              >
                {tr('توسيع', 'Expand')}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 thea-scroll">
              {items.map((row: any) => {
                const patient = row.patient || {};
                return (
                  <TheaPatientRow
                    key={row.encounterCoreId || row.bookingId}
                    patient={{
                      id: row.encounterCoreId || row.bookingId,
                      name: patient.fullName || '—',
                      mrn: patient.mrn || '',
                      age: getAge(patient.dob) as number,
                      gender: patient.gender === 'MALE' ? 'M' : 'F',
                      status: row.opdFlowState,
                      type: row.visitType || '',
                      typeKey: row.visitType === 'FOLLOW_UP' ? 'fu' : row.visitType === 'URGENT' ? 'urg' : 'new',
                      wait: row.waitingToDoctorMinutes,
                      critical: row.criticalVitalsFlag?.active || false,
                    }}
                    selected={row.encounterCoreId === selectedEncounterId}
                    compact
                    language={language}
                    onClick={() => {
                      setSelectedEncounterId(row.encounterCoreId);
                      setActiveTab('overview');
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* ── Right: Visit Panel ── */}
          <div className="flex-1 flex flex-col min-w-0 thea-animate-ws-in">
            {/* Allergy bar */}
            {selectedItem?.latestAllergies && (
              <div className="px-4 py-2 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-t-2xl flex items-center gap-2 min-w-0">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
                <span className="text-[11px] font-bold text-red-500 dark:text-red-400 tracking-wide uppercase shrink-0">{tr('حساسية الأدوية', 'DRUG ALLERGIES')}:</span>
                <span className="text-xs font-bold text-red-900 dark:text-red-200 truncate min-w-0">{selectedItem.latestAllergies}</span>
              </div>
            )}

            {/* Tab bar */}
            <div className={`flex gap-2 px-4 py-3 bg-card border border-border items-center overflow-x-auto ${selectedItem?.latestAllergies ? 'rounded-none border-t-0' : 'rounded-t-2xl'}`}>
              {/* Receive patient — only when Ready (not yet In Exam) */}
              {selectedItem?.opdFlowState === 'READY_FOR_DOCTOR' && (
                <>
                  <button
                    onClick={() => runPtSeen(selectedItem)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 thea-transition-fast"
                  >
                    ▶ {tr('استقبال المريض', 'Receive patient')}
                  </button>
                  <div className="w-px h-5 bg-border" />
                </>
              )}
              {/* Send to procedures — only when IN_DOCTOR */}
              {selectedItem?.opdFlowState === 'IN_DOCTOR' && (
                <button
                  onClick={runSendToProcedures}
                  className="px-3 py-2 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 thea-transition-fast"
                  title={tr('إرسال المريض للفحوصات والتحاليل', 'Send patient for labs/procedures')}
                >
                  <PauseCircle className="h-4 w-4 inline-block" /> {tr('إرسال للفحوصات', 'Send for procedures')}
                </button>
              )}
              {/* Patient returned from procedures */}
              {(selectedItem?.opdFlowState === 'PROCEDURE_PENDING' || selectedItem?.opdFlowState === 'PROCEDURE_DONE_WAITING') && (
                <button
                  onClick={runPatientReturned}
                  className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 thea-transition-fast animate-pulse"
                  title={tr('المريض رجع من الفحوصات', 'Patient returned from procedures')}
                >
                  ▶ {tr('المريض رجع — أكمل', 'Patient returned — continue')}
                </button>
              )}
              {(selectedItem?.opdFlowState === 'IN_DOCTOR' || selectedItem?.opdFlowState === 'PROCEDURE_PENDING' || selectedItem?.opdFlowState === 'PROCEDURE_DONE_WAITING') && (
                <div className="w-px h-5 bg-border" />
              )}
              {/* Consent button */}
              <button
                onClick={() => setShowConsentForm(true)}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 thea-transition-fast"
                title={tr('الموافقات', 'Consents')}
              >
                <ClipboardList className="h-4 w-4" />
              </button>
              {/* Referral button */}
              <button
                onClick={() => setShowReferralDialog(true)}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 thea-transition-fast"
                title={tr('تحويل', 'Referral')}
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              {/* Complete Visit button — shown when doctor is actively seeing the patient */}
              {(selectedItem?.opdFlowState === 'IN_DOCTOR' ||
                selectedItem?.opdFlowState === 'PROCEDURE_DONE_WAITING') && (
                <button
                  onClick={() => runCompleteVisit()}
                  className="px-3 py-2 rounded-xl bg-slate-700 text-white text-sm font-bold hover:bg-slate-800 thea-transition-fast"
                  title={tr('إنهاء الزيارة وإرسال المريض للمنزل', 'Complete visit and send patient home')}
                >
                  <Flag className="h-4 w-4 inline-block" /> {tr('إنهاء الزيارة', 'Complete Visit')}
                </button>
              )}
              <div className="w-px h-5 bg-border mx-1" />
              {DOCTOR_TABS.map(tab => (
                <div key={tab.id} className="relative shrink-0">
                  <TheaTab
                    label={`${tab.icon} ${tr(tab.label, tab.labelEn)}`}
                    active={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                  />
                  {tab.id === 'care-gaps' && careGapCount > 0 && (
                    <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none px-1">
                      {careGapCount > 9 ? '9+' : careGapCount}
                    </span>
                  )}
                </div>
              ))}
              {isDentalSpecialty && (
                <TheaTab
                  label={tr('الأسنان', 'Dental')}
                  active={activeTab === 'dental'}
                  onClick={() => setActiveTab('dental')}
                />
              )}
              <div className="flex-1" />
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                {isValidating ? tr('جارٍ التحديث...', 'Refreshing...') : `${tr('آخر تحديث', 'Updated')} ${refreshCountdown}s`}
              </span>
            </div>

            {/* Panel content */}
            <div className="flex-1 bg-card rounded-b-2xl border border-t-0 border-border p-4 overflow-y-auto thea-scroll">
              {/* Overview is always accessible */}
              {activeTab === 'overview' && (
                <OverviewPanel
                  visitId={selectedEncounterId}
                  onNavigateBack={() => { setSelectedEncounterId(null); mutate(); }}
                />
              )}
              {/* Results is read-only, always accessible */}
              {activeTab === 'results' && <ResultsPanel visitId={selectedEncounterId} />}
              {/* Clinical tabs require doctor to "Receive patient" first */}
              {activeTab !== 'overview' && activeTab !== 'results' && !isDoctorActive && (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                  <Stethoscope className="h-12 w-12 text-slate-400" />
                  <h3 className="text-lg font-semibold text-slate-700">
                    {tr('يجب استقبال المريض أولاً', 'You must receive the patient first')}
                  </h3>
                  <p className="text-sm text-slate-500 max-w-sm">
                    {tr(
                      'اضغط على زر "استقبال المريض" في شريط التابات أعلاه لبدء الكشف والوصول للملاحظات والأوامر.',
                      'Click the "Receive patient" button in the tab bar above to start the examination and access notes and orders.'
                    )}
                  </p>
                  {selectedItem?.opdFlowState === 'READY_FOR_DOCTOR' && (
                    <button
                      onClick={() => runPtSeen(selectedItem)}
                      className="mt-2 px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 thea-transition-fast"
                    >
                      {tr('استقبال المريض', 'Receive patient')} ▶
                    </button>
                  )}
                </div>
              )}
              {activeTab === 'soap' && isDoctorActive && <SoapPanel visitId={selectedEncounterId} specialtyCode={selectedItem?.specialtyCode || ''} />}
              {activeTab === 'diagnosis' && isDoctorActive && <DiagnosisPanel visitId={selectedEncounterId} />}
              {activeTab === 'orders' && isDoctorActive && <OrdersPanel visitId={selectedEncounterId} />}
              {activeTab === 'prescription' && isDoctorActive && <PrescriptionPanel visitId={selectedEncounterId} />}
              {activeTab === 'referrals' && isDoctorActive && <ReferralsPanel visitId={selectedEncounterId} />}
              {activeTab === 'care-gaps' && isDoctorActive && (
                <CareGapsPanel
                  visitId={selectedEncounterId}
                  patientId={selectedItem?.patient?.id || selectedItem?.patientMasterId}
                />
              )}
              {activeTab === 'smart-report' && isDoctorActive && <SmartVisitReport encounterCoreId={selectedEncounterId} />}
              {activeTab === 'discharge' && isDoctorActive && <DischargePanel visitId={selectedEncounterId} />}
              {activeTab === 'dental' && isDoctorActive && isDentalSpecialty && selectedPatientId && (
                <DentalPanel patientId={selectedPatientId} />
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════
             FULL VIEW — No patient selected
           ══════════════════════════════════════════════════════ */
        <div className="space-y-2">
          {items.map((row: any) => {
            const patient = row.patient || {};
            const isReady = row.opdFlowState === 'READY_FOR_DOCTOR';
            const isPostProc = row.opdFlowState === 'PROCEDURE_DONE_WAITING';

            return (
              <TheaPatientRow
                key={row.bookingId}
                patient={{
                  id: row.encounterCoreId || row.bookingId,
                  name: patient.fullName || '—',
                  mrn: patient.mrn || '',
                  age: getAge(patient.dob) as number,
                  gender: patient.gender === 'MALE' ? 'M' : 'F',
                  status: row.opdFlowState,
                  type: row.visitType || '',
                  typeKey: row.visitType === 'FOLLOW_UP' ? 'fu' : row.visitType === 'URGENT' ? 'urg' : 'new',
                  wait: row.waitingToDoctorMinutes,
                  critical: row.criticalVitalsFlag?.active || false,
                  allergies: row.latestAllergies ? [row.latestAllergies] : [],
                  complaint: row.chiefComplaint,
                }}
                selected={false}
                compact={false}
                language={language}
                onClick={() => {
                  if (row.encounterCoreId) {
                    setSelectedEncounterId(row.encounterCoreId);
                    setActiveTab('overview');
                  }
                }}
              />
            );
          })}

          {/* Empty state */}
          {!items.length && !isValidating && (
            <div className="bg-card rounded-2xl border border-border py-16 text-center thea-animate-fade-in">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center"><Stethoscope className="h-7 w-7 text-muted-foreground" /></div>
              <div className="text-base font-bold text-foreground">{tr('لا يوجد مرضى في الطابور', 'No patients in queue')}</div>
              <div className="text-sm text-muted-foreground mt-1">{tr('جدولك فارغ. سيظهر المرضى الجدد تلقائياً.', 'Your schedule is empty. New patients will appear automatically.')}</div>
            </div>
          )}
        </div>
      )}

      {/* C1: Consent Form Modal */}
      {showConsentForm && selectedItem && (
        <ConsentForm
          consentType={consentType}
          patientName={selectedItem.patient?.fullName || ''}
          patientId={selectedItem.patient?.id || selectedItem.patientMasterId || ''}
          encounterId={selectedEncounterId}
          onComplete={handleConsentComplete}
          onCancel={() => setShowConsentForm(false)}
        />
      )}

      {/* C2: Smart Referral Dialog */}
      {showReferralDialog && selectedEncounterId && selectedItem && (
        <SmartReferralDialog
          open={showReferralDialog}
          onClose={() => setShowReferralDialog(false)}
          encounterId={selectedEncounterId}
          patientId={selectedItem.patient?.id || selectedItem.patientMasterId || ''}
          patientName={selectedItem.patient?.fullName || ''}
          fromProviderId={data?.doctor?.providerId}
          fromProviderName={data?.doctor?.displayName}
          onSuccess={() => mutate()}
        />
      )}
    </div>
  );
}
