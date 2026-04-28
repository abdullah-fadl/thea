'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useOpdEvents } from '@/hooks/useOpdEvents';
import { getAge, formatGender, formatDateLabel, formatWait, getWaitColor, parseSystolic, formatTime, addDaysToDateString } from '@/lib/opd/ui-helpers';
import { OPD_STATUS_CONFIG, DEFAULT_STATUS, VISIT_TYPE_CONFIG, DOCTOR_TABS } from '@/lib/opd/ui-config';
import { ConsentForm, type ConsentData } from '@/components/consent/ConsentForm';
import { CONSENT_TYPES } from '@/lib/clinical/consentTypes';
import {
  Stethoscope,
  CalendarDays,
  RefreshCw,
  Hourglass,
  Users,
  CheckCircle2,
  Flag,
  Search,
  AlertTriangle,
  XCircle,
  ClipboardList,
  Timer,
  MessageSquare,
} from 'lucide-react';

const OverviewPanel = dynamic(() => import('@/components/opd/panels/OverviewPanel'), { ssr: false });
const SoapPanel = dynamic(() => import('@/components/opd/panels/SoapPanel'), { ssr: false });
const OrdersPanel = dynamic(() => import('@/components/opd/panels/OrdersPanel'), { ssr: false });
const PrescriptionPanel = dynamic(() => import('@/components/opd/panels/PrescriptionPanel'), { ssr: false });
const SmartVisitReport = dynamic(() => import('@/components/opd/SmartVisitReport'), { ssr: false });
const ResultsPanel = dynamic(() => import('@/components/opd/panels/ResultsPanel'), { ssr: false });
const DischargePanel = dynamic(() => import('@/components/opd/panels/DischargePanel'), { ssr: false });

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

/* ══════════════════════════════════════════════════════════════
   محطة الطبيب – Doctor Station (Thea Design — fallback)
   ══════════════════════════════════════════════════════════════ */
export default function DoctorStationThea() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();
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

  /* ── Permission gate ── */
  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

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

  // C1: Handle consent completion
  const handleConsentComplete = async (data: ConsentData) => {
    try {
      await fetch('/api/clinical/consents', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          encounterId: selectedEncounterId,
          patientId: selectedItem?.patient?.id || selectedItem?.patientMasterId,
        }),
      });
      toast({ title: language === 'ar' ? 'تم حفظ الموافقة' : 'Consent saved' });
      setShowConsentForm(false);
    } catch {
      toast({ title: language === 'ar' ? 'فشل حفظ الموافقة' : 'Failed to save consent', variant: 'destructive' });
    }
  };

  /* ── Actions ── */
  const runPtSeen = async (row: any) => {
    if (!row?.encounterCoreId || isPast) return;
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
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' });
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

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50">
      {/* ── Header ── */}
      <div className="bg-card border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Stethoscope className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">محطة الطبيب</h1>
                <p className="text-xs text-slate-500">{doctorName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Date navigation */}
              <div className="relative">
                <div className="flex items-center bg-slate-100 rounded-lg">
                  <button
                    onClick={() => navigateDate(-1)}
                    className="px-2 py-2 hover:bg-slate-200 rounded-l-lg text-slate-600 transition-colors"
                  >
                    ◀
                  </button>
                  <button
                    onClick={() => setShowCalendar(!showCalendar)}
                    className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors flex items-center gap-1.5"
                  >
                    <CalendarDays className="w-4 h-4 inline-block" /> {isToday ? (language === 'ar' ? 'اليوم' : 'Today') : formatDateLabel(selectedDate, language)}
                  </button>
                  <button
                    onClick={() => navigateDate(1)}
                    className="px-2 py-2 hover:bg-slate-200 rounded-r-lg text-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    disabled={selectedDate >= today}
                  >
                    ▶
                  </button>
                </div>

                {showCalendar ? (
                  <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} top-full mt-2 bg-card rounded-xl shadow-xl border border-slate-200 p-4 z-50 w-80 animate-calendarIn`}>
                    <div className="flex items-center justify-between mb-3">
                      <button
                        onClick={() => {
                          if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
                          else setCalMonth(calMonth - 1);
                        }}
                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                      >
                        ◀
                      </button>
                      <span className="text-sm font-semibold text-slate-800">
                        {new Date(calYear, calMonth).toLocaleString('ar-SA', { month: 'long' })} {calYear}
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
                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                      >
                        ▶
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center mb-1">
                      {['أح', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب'].map((d) => (
                        <div key={d} className="text-[10px] font-medium text-slate-400 py-1">{d}</div>
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
                            className={`h-8 w-8 rounded-lg text-xs flex items-center justify-center relative transition-all
                              ${disabled ? 'text-slate-300 cursor-not-allowed' : 'hover:bg-emerald-50 cursor-pointer'}
                              ${!day.curr ? 'text-slate-300' : 'text-slate-700'}
                              ${isSel ? 'bg-emerald-600 text-white font-bold hover:bg-emerald-700' : ''}
                              ${isTod && !isSel ? 'ring-2 ring-emerald-400 font-semibold' : ''}`}
                          >
                            {day.d}
                            {isTod ? <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-emerald-500" /> : null}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => { setSelectedDate(today); setShowCalendar(false); }}
                        className="flex-1 text-xs py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 font-medium transition-colors"
                      >
                        اليوم
                      </button>
                      <button
                        onClick={() => {
                          const y = new Date(`${today}T00:00:00`);
                          y.setDate(y.getDate() - 1);
                          setSelectedDate(y.toISOString().slice(0, 10));
                          setShowCalendar(false);
                        }}
                        className="flex-1 text-xs py-1.5 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 font-medium transition-colors"
                      >
                        أمس
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* LIVE indicator */}
              {isToday ? (
                <button
                  onClick={() => { setAutoRefresh(!autoRefresh); if (!autoRefresh) setRefreshCountdown(15); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    autoRefresh
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  <span className="relative flex h-2 w-2">
                    {autoRefresh ? (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    ) : null}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${autoRefresh ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  </span>
                  {autoRefresh ? `LIVE · ${refreshCountdown}s` : tr('متوقف', 'PAUSED')}
                </button>
              ) : null}

              <button
                onClick={() => { setRefreshCountdown(15); mutate(); }}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                title={tr('تحديث الآن', 'Refresh now')}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes calendarIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-calendarIn { animation: calendarIn 0.2s ease-out; }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">
        {/* Past-date warning */}
        {isPast ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hourglass className="w-4 h-4 text-amber-600" />
              <span className="text-sm text-amber-800">
                {tr('عرض بيانات تاريخية ليوم', 'Showing historical data for')} <strong>{formatDateLabel(selectedDate, language)}</strong> — {tr('الإجراءات معطّلة', 'actions are disabled')}.
              </span>
            </div>
            <button
              onClick={() => setSelectedDate(today)}
              className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              {tr('العودة لليوم', 'Back to today')}
            </button>
          </div>
        ) : null}

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard icon={<Users className="w-5 h-5 text-slate-500" />} label={tr('الإجمالي', 'Total')} value={items.length} sub={isToday ? tr('مرضى اليوم', "Today's patients") : formatDateLabel(selectedDate, language)} color="slate" />
          <KPICard icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} label={tr('جاهز', 'Ready')} value={ready} sub={tr('جاهز للكشف', 'Ready for consult')} color="emerald" />
          <KPICard icon={<Hourglass className="w-5 h-5 text-amber-500" />} label={tr('ينتظر', 'Waiting')} value={waiting} sub={tr('في الطابور', 'In queue')} color="amber" />
          <KPICard icon={<Flag className="w-5 h-5 text-blue-500" />} label={tr('مكتمل', 'Completed')} value={completed} sub={tr('تم الكشف', 'Consulted')} color="blue" />
        </div>

        {/* ── Search ── */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={tr('ابحث بالاسم أو رقم الملف...', 'Search by name or MRN...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 transition-all"
          />
        </div>

        {/* ── Error states ── */}
        {reason === 'NO_STAFF_ID' ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center"><AlertTriangle className="w-6 h-6 text-amber-600" /></div>
              <div>
                <h3 className="font-semibold text-amber-800 text-lg mb-1">{tr('حسابك غير مرتبط بطبيب', 'Your account is not linked to a doctor')}</h3>
                <p className="text-amber-700 mb-3">{tr('معرّف الموظف مفقود من حسابك. يرجى التواصل مع مسؤول النظام.', 'Staff ID is missing from your account. Please contact administrator.')}</p>
                <div className="text-sm text-amber-600 bg-amber-100 rounded-lg p-3">
                  <strong>{tr('المسؤول', 'Admin')}:</strong> {tr('اذهب إلى الإدارة → المستخدمين → اختر هذا المستخدم → حدّد معرّف الموظف ليطابق مقدمي الخدمة.', 'Go to Admin → Users → select this user → set Staff ID to match provider records.')}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {reason === 'NO_PROVIDER' ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center"><XCircle className="w-6 h-6 text-red-600" /></div>
              <div>
                <h3 className="font-semibold text-red-800 text-lg mb-1">{tr('لم يتم العثور على معرّف الموظف في مقدمي الخدمة', 'Staff ID not found in providers')}</h3>
                <p className="text-red-700 mb-3">{tr('معرّف الموظف في حسابك لا يطابق أي سجل طبيب.', 'Your account Staff ID does not match any doctor record.')}</p>
                <div className="text-sm text-red-600 bg-red-100 rounded-lg p-3">
                  <strong>{tr('المسؤول', 'Admin')}:</strong> {tr('تأكد من تطابق معرّف الموظف في الإدارة → المستخدمين والإدارة → البنية السريرية → مقدمي الخدمة.', 'Ensure Staff ID matches in Admin → Users and Admin → Clinical Infrastructure → Providers.')}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {reason === 'NO_RESOURCES' ? (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center"><CalendarDays className="w-6 h-6 text-blue-600" /></div>
              <div>
                <h3 className="font-semibold text-blue-800 text-lg mb-1">لم يتم إعداد الجدول</h3>
                <p className="text-blue-700 mb-3">سجل مقدم الخدمة مرتبط، لكن لا توجد موارد جدولة بعد.</p>
                <div className="text-sm text-blue-600 bg-blue-100 rounded-lg p-3">
                  <strong>المسؤول:</strong> اذهب إلى الجدولة → الموارد وأنشئ مورد مقدم خدمة، ثم أنشئ القوالب وولّد الفترات.
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {selectedEncounterId ? (
          /* ═══ SPLIT VIEW: Patient List + Visit Panels ═══ */
          <div className="flex gap-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
            {/* Left: Compact Patient List */}
            <div className="w-72 shrink-0 bg-card rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">المرضى ({items.length})</span>
                <button
                  onClick={() => { setSelectedEncounterId(null); setActiveTab('overview'); }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                >
                  ← توسيع
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {items.map((row: any) => {
                  const isSelected = row.encounterCoreId === selectedEncounterId;
                  const sc = OPD_STATUS_CONFIG[row.opdFlowState] || DEFAULT_STATUS;
                  const patient = row.patient || {};
                  return (
                    <div
                      key={row.encounterCoreId || row.bookingId}
                      onClick={() => { setSelectedEncounterId(row.encounterCoreId); setActiveTab('overview'); }}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                        isSelected ? 'bg-blue-50 border-2 border-blue-500' : 'hover:bg-slate-50 border-2 border-transparent'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                        isSelected ? 'bg-blue-600' : patient.gender === 'MALE' ? 'bg-blue-500' : patient.gender === 'FEMALE' ? 'bg-pink-500' : 'bg-slate-400'
                      }`}>
                        {(patient.fullName || '?').charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-800 truncate">{patient.fullName}</div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                          {sc.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Visit Panel */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Tab Bar */}
              <div className="flex gap-1 bg-card rounded-t-2xl border border-b-0 border-slate-200 px-3 pt-2 overflow-x-auto items-center">
                {/* C1: Consent button */}
                <button
                  onClick={() => setShowConsentForm(true)}
                  className="px-3 py-2 rounded-t-xl text-sm text-slate-500 hover:text-blue-600 transition whitespace-nowrap"
                  title={language === 'ar' ? 'الموافقات' : 'Consents'}
                >
                  <ClipboardList className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-slate-200 mx-1" />
                {DOCTOR_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2.5 rounded-t-xl text-sm font-bold whitespace-nowrap transition-all ${
                      activeTab === tab.id
                        ? 'bg-card text-blue-600 border-b-2 border-blue-600'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {/* Panel Content */}
              <div className="flex-1 bg-card rounded-b-2xl border border-t-0 border-slate-200 p-4 overflow-y-auto">
                {activeTab === 'overview' && (
                  <OverviewPanel
                    visitId={selectedEncounterId}
                    onNavigateBack={() => { setSelectedEncounterId(null); mutate(); }}
                  />
                )}
                {activeTab === 'soap' && <SoapPanel visitId={selectedEncounterId} specialtyCode={selectedItem?.specialtyCode || ''} />}
                {activeTab === 'orders' && <OrdersPanel visitId={selectedEncounterId} />}
                {activeTab === 'prescription' && <PrescriptionPanel visitId={selectedEncounterId} />}
                {activeTab === 'results' && <ResultsPanel visitId={selectedEncounterId} />}
                {activeTab === 'smart-report' && <SmartVisitReport encounterCoreId={selectedEncounterId} />}
                {activeTab === 'discharge' && <DischargePanel visitId={selectedEncounterId} />}
              </div>
            </div>
          </div>
        ) : (
          /* ═══ FULL VIEW: Patient Cards ═══ */
          <>
        <div className="space-y-2">
          {items.map((row: any) => {
            const sc = OPD_STATUS_CONFIG[row.opdFlowState] || DEFAULT_STATUS;
            const patient = row.patient || {};
            const age = getAge(patient.dob);
            const isExpanded = expandedId === row.bookingId;
            const isReady = row.opdFlowState === 'READY_FOR_DOCTOR';
            const isPostProc = row.opdFlowState === 'PROCEDURE_DONE_WAITING';
            const waitMin = row.waitingToDoctorMinutes;
            const vt = VISIT_TYPE_CONFIG[row.visitType] || { label: row.visitType || '—', color: 'bg-slate-100 text-slate-600' };
            const vitals = row.latestVitals || {};
            const systolic = parseSystolic(vitals.bp);
            const hasAllergies = Boolean(row.latestAllergies);

            return (
              <div
                key={row.bookingId}
                className={`bg-card rounded-xl border transition-all ${
                  isReady
                    ? 'border-emerald-300 shadow-sm shadow-emerald-100'
                    : isPostProc
                      ? 'border-purple-300 shadow-sm shadow-purple-100'
                      : 'border-slate-200'
                }`}
              >
                {/* ── Collapsed row ── */}
                <div
                  className="px-4 py-3 cursor-pointer hover:bg-slate-50/50"
                  onClick={() => setExpandedId(isExpanded ? null : row.bookingId)}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                        patient.gender === 'MALE' ? 'bg-blue-500' : patient.gender === 'FEMALE' ? 'bg-pink-500' : 'bg-slate-400'
                      }`}
                    >
                      {(patient.fullName || '?')[0]}
                    </div>

                    {/* Patient info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900 truncate">{patient.fullName}</span>
                        {row.criticalVitalsFlag?.active && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-600 text-white rounded animate-pulse inline-flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> حرج</span>
                        )}
                        {row.priority && row.priority !== 'NORMAL' && (
                          <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                            row.priority === 'URGENT' ? 'bg-red-100 text-red-800' :
                            row.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {row.priority === 'URGENT' ? 'عاجل' : row.priority === 'HIGH' ? 'مرتفع' : 'منخفض'}
                          </span>
                        )}
                        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${vt.color}`}>{vt.label}</span>
                        {row.hasNewResults && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-bold animate-pulse inline-flex items-center gap-0.5"><ClipboardList className="w-3 h-3" /> نتائج</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{patient.mrn}</span>
                        {age !== '—' && <span>· {age}y · {formatGender(patient.gender)}</span>}
                        {row.startAt && <span>· {formatTime(row.startAt, language)}</span>}
                        {row.bookingTypeLabel === 'WALK_IN' && <span className="text-amber-500">· بدون موعد</span>}
                      </div>
                    </div>

                    {/* Right side badges */}
                    <div className="flex items-center gap-3 shrink-0">
                      {hasAllergies && (
                        <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-medium inline-flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> حساسية</span>
                      )}
                      {typeof waitMin === 'number' && (
                        <div className="text-center">
                          <div className={`text-xs font-bold ${getWaitColor(waitMin)} inline-flex items-center gap-0.5`}><Timer className="w-3 h-3" /> {formatWait(waitMin, language)}</div>
                        </div>
                      )}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${sc.bg} ${sc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}
                      </span>
                      <span className="text-slate-300 text-xs">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Chief complaint preview */}
                  {row.chiefComplaint && !isExpanded && (
                    <div className="mt-1.5 mr-12 text-[10px] text-slate-500 truncate inline-flex items-center gap-0.5"><MessageSquare className="w-3 h-3 shrink-0" /> {row.chiefComplaint}</div>
                  )}
                </div>

                {/* ── Expanded details ── */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                    {/* Chief complaint */}
                    {row.chiefComplaint && (
                      <div className="bg-amber-50 rounded-lg px-3 py-2">
                        <div className="text-[10px] font-semibold text-amber-700 mb-0.5">الشكوى الرئيسية</div>
                        <div className="text-xs text-amber-900">{row.chiefComplaint}</div>
                      </div>
                    )}

                    {/* Vitals grid */}
                    {row.latestVitals && (
                      <div>
                        <div className="text-[10px] font-semibold text-slate-500 mb-1">العلامات الحيوية</div>
                        <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5">
                          {[
                            { label: 'BP', value: vitals.bp, unit: '', alert: (systolic ?? 0) >= 140 },
                            { label: 'HR', value: vitals.hr, unit: 'bpm', alert: vitals.hr > 100 },
                            { label: 'Temp', value: vitals.temp, unit: '°C', alert: vitals.temp >= 37.5 },
                            { label: 'SpO₂', value: vitals.spo2, unit: '%', alert: vitals.spo2 < 95 },
                            { label: 'RR', value: vitals.rr, unit: '/m', alert: false },
                            { label: 'الوزن', value: vitals.weight, unit: 'kg', alert: false },
                            { label: 'الطول', value: vitals.height, unit: 'cm', alert: false },
                            { label: 'BMI', value: vitals.bmi, unit: '', alert: false },
                          ]
                            .filter((v) => v.value !== null && v.value !== undefined && v.value !== '')
                            .map((v) => (
                              <div key={v.label} className={`rounded-lg px-2 py-1.5 text-center ${v.alert ? 'bg-red-50' : 'bg-slate-50'}`}>
                                <div className="text-[9px] text-slate-400">{v.label}</div>
                                <div className={`text-xs font-bold ${v.alert ? 'text-red-700' : 'text-slate-700'}`}>
                                  {v.value}
                                  <span className="text-[9px] font-normal text-slate-400">{v.unit}</span>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Allergy / Pain / Fall risk badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {hasAllergies && (
                        <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-medium inline-flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3" /> {row.latestAllergies}
                        </span>
                      )}
                      {row.painScore !== null && row.painScore !== undefined && row.painScore > 0 && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          row.painScore >= 7 ? 'bg-red-100 text-red-700' : row.painScore >= 4 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          الألم: {row.painScore}/10
                        </span>
                      )}
                      {row.fallRisk && (
                        <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-medium">
                          السقوط: {row.fallRisk}
                        </span>
                      )}
                    </div>

                    {/* Nursing note */}
                    {row.nursingNote && (
                      <div className="text-[10px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                        <span className="font-semibold">ملاحظة التمريض:</span> {row.nursingNote}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      {isReady && !isPast && (
                        <button
                          onClick={(e) => { e.stopPropagation(); runPtSeen(row); }}
                          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm"
                        >
                          ▶ استقبال المريض
                        </button>
                      )}
                      {isPostProc && !isPast && row.encounterCoreId && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedEncounterId(row.encounterCoreId); setActiveTab('results'); }}
                          className="px-4 py-2 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 shadow-sm"
                        >
                          ▶ مراجعة النتائج
                        </button>
                      )}
                      {row.encounterCoreId && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedEncounterId(row.encounterCoreId); setActiveTab('overview'); }}
                          disabled={row.opdFlowState !== 'IN_DOCTOR' && row.opdFlowState !== 'COMPLETED' && row.opdFlowState !== 'PROCEDURE_DONE_WAITING'}
                          className={`px-3 py-2 rounded-lg border text-xs font-medium ${
                            row.opdFlowState === 'IN_DOCTOR' || row.opdFlowState === 'COMPLETED' || row.opdFlowState === 'PROCEDURE_DONE_WAITING'
                              ? 'border-blue-300 text-blue-700 hover:bg-blue-50'
                              : 'border-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          فتح الزيارة ›
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty state */}
          {!items.length && !isValidating ? (
            <div className="bg-card rounded-xl border border-slate-200 py-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center"><Stethoscope className="w-8 h-8 text-slate-400" /></div>
              <div className="text-lg font-medium text-slate-900">لا يوجد مرضى في الطابور</div>
              <div className="text-sm text-slate-500 mt-1">جدولك فارغ. سيظهر المرضى الجدد تلقائياً.</div>
            </div>
          ) : null}
        </div>
          </>
        )}
      </div>
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
    </div>
  );
}

/* ── KPI Card component ── */
function KPICard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: number; sub: string;
  color: 'slate' | 'emerald' | 'amber' | 'blue';
}) {
  const colors = {
    slate:   'border-slate-200 bg-card',
    emerald: 'border-emerald-200 bg-emerald-50/50',
    amber:   'border-amber-200 bg-amber-50/50',
    blue:    'border-blue-200 bg-blue-50/50',
  };
  return (
    <div className={`rounded-xl border p-3 ${colors[color] || colors.slate}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-medium text-slate-500 uppercase">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{sub}</div>
    </div>
  );
}
