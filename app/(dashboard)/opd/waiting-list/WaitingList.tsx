'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useMe } from '@/lib/hooks/useMe';
import { useOpdEvents } from '@/hooks/useOpdEvents';
import { getAge, formatWait, getWaitColor, formatTime, addDaysToDateString } from '@/lib/opd/ui-helpers';
import { OPD_STATUS_CONFIG, DEFAULT_STATUS, getVisitTypeConfig, getSourceTypeConfig } from '@/lib/opd/ui-config';
import { TheaKpiCard, TheaTab } from '@/components/thea-ui';
import {
  Building2,
  CalendarDays,
  AlertTriangle,
  ClipboardList,
  CheckCircle2,
  Bell,
  Clock,
  MessageSquare,
  Flag,
  Banknote,
  AlertOctagon,
  Search,
  Timer,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

function getResolvedStatus(item: any) {
  const flow = item.opdFlowState;
  if (flow && OPD_STATUS_CONFIG[flow]) return flow;
  if (item.isPendingPayment) return 'PENDING_PAYMENT';
  if (item.checkedInAt) return 'CHECKED_IN';
  return 'BOOKED';
}

function formatDateLabel(dateStr: string, language: 'ar' | 'en' = 'ar') {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function FlowProgress({ step }: { step: number }) {
  const maxSteps = 7;
  const pct = Math.min(100, Math.round((step / maxSteps) * 100));
  const barColor =
    step >= 7 ? 'bg-emerald-500' :
    step >= 5 ? 'bg-blue-500' :
    step >= 4 ? 'bg-emerald-400' :
    step >= 2 ? 'bg-cyan-400' :
    step >= 1 ? 'bg-indigo-400' : 'bg-muted';

  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground w-6 text-right">{pct}%</span>
    </div>
  );
}

export default function WaitingList() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();
  const router = useRouter();
  const { hasPermission, isLoading } = useRoutePermission('/opd/waiting-list');
  const { me } = useMe();

  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
  const [selectedDate, setSelectedDate] = useState(today);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [filterClinic, setFilterClinic] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [showCompleted, setShowCompleted] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshCountdown, setRefreshCountdown] = useState(15);
  const [checkInItem, setCheckInItem] = useState<any>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [confirmPaymentItem, setConfirmPaymentItem] = useState<any>(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const isToday = selectedDate === today;
  const isPast = selectedDate < today;

  const { data, mutate, isValidating } = useSWR(
    hasPermission ? `/api/opd/queue?date=${selectedDate}` : null,
    fetcher,
    { refreshInterval: autoRefresh && isToday ? 15000 : 0, keepPreviousData: true }
  );

  const countdownRef = useRef(15);
  useEffect(() => {
    if (!autoRefresh || !isToday) return;
    countdownRef.current = refreshCountdown;
    const interval = setInterval(() => {
      countdownRef.current -= 1;
      if (countdownRef.current <= 0) {
        countdownRef.current = 15;
        setRefreshCountdown(15);
        mutate();
      } else {
        setRefreshCountdown(countdownRef.current);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, isToday, mutate]);

  useEffect(() => {
    if (isPast) setAutoRefresh(false);
    setRefreshCountdown(15);
  }, [isPast, selectedDate]);

  useEffect(() => {
    if (data) setLastRefresh(new Date());
  }, [data]);

  const navigateDate = useCallback(
    (dir: number) => {
      const ns = addDaysToDateString(selectedDate, dir);
      if (ns > today) return;
      setSelectedDate(ns);
    },
    [selectedDate, today]
  );

  const calDays = useMemo(() => {
    const first = new Date(calYear, calMonth, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const prevMonthDays = new Date(calYear, calMonth, 0).getDate();
    const grid: Array<{ day: number; current: boolean }> = [];
    for (let i = startDay - 1; i >= 0; i--) grid.push({ day: prevMonthDays - i, current: false });
    for (let i = 1; i <= daysInMonth; i++) grid.push({ day: i, current: true });
    while (grid.length < 42) grid.push({ day: grid.length - daysInMonth - startDay + 1, current: false });
    return grid;
  }, [calMonth, calYear]);

  const selectCalDay = (day: number) => {
    const m = String(calMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const ds = `${calYear}-${m}-${d}`;
    if (ds > today) return;
    setSelectedDate(ds);
    setShowCalendar(false);
  };

  useOpdEvents(
    useCallback((event) => {
      if (['FLOW_STATE_CHANGE', 'NEW_PATIENT'].includes(event.type)) {
        mutate();
      }
    }, [mutate]),
    hasPermission
  );

  const allItems = Array.isArray(data?.items) ? data.items : [];
  const clinics = Array.isArray(data?.clinics) ? data.clinics : [];

  const filtered = useMemo(() => {
    let items = allItems;

    if (filterClinic !== 'ALL') items = items.filter((i: any) => i.clinicId === filterClinic);

    if (filterStatus === 'WAITING') {
      items = items.filter((i: any) => {
        const s = i.opdFlowState || (i.checkedInAt ? 'CHECKED_IN' : 'BOOKED');
        return ['CHECKED_IN', 'ARRIVED', 'WAITING_NURSE', 'READY_FOR_DOCTOR', 'WAITING_DOCTOR'].includes(s);
      });
    } else if (filterStatus === 'IN_PROGRESS') {
      items = items.filter((i: any) => {
        const s = i.opdFlowState;
        return ['IN_NURSING', 'IN_DOCTOR', 'PROCEDURE_PENDING', 'PROCEDURE_DONE_WAITING'].includes(s);
      });
    } else if (filterStatus === 'NOT_CHECKED_IN') {
      items = items.filter((i: any) => !i.checkedInAt);
    } else if (filterStatus === 'PENDING_PAYMENT') {
      items = items.filter((i: any) => i.isPendingPayment);
    }

    if (!showCompleted) items = items.filter((i: any) => i.opdFlowState !== 'COMPLETED');

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (i: any) => i.patient?.fullName?.toLowerCase().includes(q) || i.patient?.mrn?.toLowerCase().includes(q)
      );
    }

    return [...items].sort((a: any, b: any) => {
      const aBooked = !a.checkedInAt ? 0 : 1;
      const bBooked = !b.checkedInAt ? 0 : 1;
      if (aBooked !== bBooked) return aBooked - bBooked;
      return (b.waitingSinceMinutes || 0) - (a.waitingSinceMinutes || 0);
    });
  }, [allItems, filterClinic, filterStatus, showCompleted, search]);

  const total = allItems.length;
  const checkedIn = allItems.filter((i: any) => i.checkedInAt).length;
  const notCheckedIn = allItems.filter((i: any) => !i.checkedInAt).length;
  const waiting = allItems.filter((i: any) => {
    const s = getResolvedStatus(i);
    return ['CHECKED_IN', 'ARRIVED', 'WAITING_NURSE', 'READY_FOR_DOCTOR', 'WAITING_DOCTOR'].includes(s);
  }).length;
  const inProgress = allItems.filter((i: any) => {
    const s = getResolvedStatus(i);
    return ['IN_NURSING', 'IN_DOCTOR', 'PROCEDURE_PENDING', 'PROCEDURE_DONE_WAITING'].includes(s);
  }).length;
  const completed = allItems.filter((i: any) => getResolvedStatus(i) === 'COMPLETED').length;
  const pendingPayment = allItems.filter((i: any) => i.isPendingPayment).length;
  const longWait = allItems.filter((i: any) => (i.waitingSinceMinutes || 0) > 30).length;

  const handleCheckIn = async (item: any) => {
    if (isPast) return;
    setCheckingIn(true);
    try {
      const res = await fetch('/api/opd/booking/check-in', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: item.bookingId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Check-in failed');
      toast({ title: tr('تم تسجيل حضور المريض', 'Patient checked in') });
      mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشل تسجيل الحضور', 'Check-in failed'), variant: 'destructive' });
    } finally {
      setCheckingIn(false);
      setCheckInItem(null);
    }
  };

  const handleConfirmPayment = async (item: any) => {
    if (isPast) return;
    setConfirmingPayment(true);
    try {
      const res = await fetch(`/api/opd/booking/${item.bookingId}/confirm-payment`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Confirm payment failed');
      toast({ title: tr('تم تأكيد الدفع', 'Payment confirmed') });
      mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشل تأكيد الدفع', 'Confirm payment failed'), variant: 'destructive' });
    } finally {
      setConfirmingPayment(false);
      setConfirmPaymentItem(null);
    }
  };

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-background">
      {/* ── Header bar ── */}
      <div className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg shadow-sm">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">{tr('الاستقبال', 'Reception')}</h1>
                <p className="text-xs text-muted-foreground">{tr('قائمة انتظار العيادات الخارجية', 'OPD waiting list')}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isToday ? (
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium thea-transition-fast ${
                    autoRefresh
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30'
                      : 'bg-muted text-muted-foreground border border-border'
                  }`}
                >
                  {autoRefresh ? (
                    <span className="relative flex h-2 w-2">
                      <span className="thea-animate-breathe absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                  ) : null}
                  {autoRefresh ? `LIVE · ${refreshCountdown}s` : tr('LIVE · متوقف', 'LIVE · OFF')}
                </button>
              ) : null}
              <button
                onClick={() => {
                  setRefreshCountdown(15);
                  mutate();
                }}
                className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground thea-transition-fast"
                title={tr('تحديث الآن', 'Refresh now')}
              >
                ↻
              </button>
            </div>
          </div>

          {/* ── Date navigation ── */}
          <div className="flex items-center gap-2 relative">
            <button
              onClick={() => navigateDate(-1)}
              className="w-8 h-8 rounded-xl border border-border hover:bg-muted text-muted-foreground flex items-center justify-center text-sm thea-transition-fast"
            >
              ◀
            </button>
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className={`px-3 py-1.5 rounded-xl border text-sm font-medium thea-transition-fast ${
                isToday ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-card border-border text-foreground'
              }`}
            >
              <CalendarDays className="w-4 h-4 inline-block align-middle" /> {isToday ? (language === 'ar' ? 'اليوم' : 'Today') : formatDateLabel(selectedDate, language)}
            </button>
            <button
              onClick={() => navigateDate(1)}
              disabled={selectedDate >= today}
              className="w-8 h-8 rounded-xl border border-border hover:bg-muted text-muted-foreground flex items-center justify-center text-sm disabled:opacity-30 disabled:cursor-not-allowed thea-transition-fast"
            >
              ▶
            </button>

            {/* ── Calendar popup ── */}
            {showCalendar ? (
              <div className="thea-animate-slide-up absolute top-full left-0 mt-2 bg-card rounded-2xl border border-border shadow-xl p-3 z-50 w-[280px]">
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => {
                      if (calMonth === 0) {
                        setCalMonth(11);
                        setCalYear(calYear - 1);
                      } else setCalMonth(calMonth - 1);
                    }}
                    className="w-7 h-7 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground text-xs thea-transition-fast"
                  >
                    ◀
                  </button>
                  <span className="text-sm font-semibold text-foreground">
                    {new Date(calYear, calMonth).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    onClick={() => {
                      const nextMonth = calMonth === 11 ? 0 : calMonth + 1;
                      const nextYear = calMonth === 11 ? calYear + 1 : calYear;
                      const firstOfNext = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01`;
                      if (firstOfNext > today) return;
                      if (calMonth === 11) {
                        setCalMonth(0);
                        setCalYear(calYear + 1);
                      } else setCalMonth(calMonth + 1);
                    }}
                    className="w-7 h-7 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground text-xs thea-transition-fast"
                  >
                    ▶
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                    <div key={d} className="text-[10px] font-medium text-muted-foreground py-1">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {calDays.map((cell, idx) => {
                    if (!cell.current) return <div key={idx} className="w-8 h-8 flex items-center justify-center text-[11px] text-muted-foreground/40">{cell.day}</div>;
                    const m = String(calMonth + 1).padStart(2, '0');
                    const d = String(cell.day).padStart(2, '0');
                    const ds = `${calYear}-${m}-${d}`;
                    const isSel = ds === selectedDate;
                    const isTodayCell = ds === today;
                    const isFuture = ds > today;
                    return (
                      <button
                        key={idx}
                        disabled={isFuture}
                        onClick={() => selectCalDay(cell.day)}
                        className={`w-8 h-8 rounded-xl flex flex-col items-center justify-center text-[11px] font-medium thea-transition-fast ${
                          isSel
                            ? 'bg-primary text-white'
                            : isTodayCell
                              ? 'ring-2 ring-primary/40 text-primary bg-primary/10'
                              : isFuture
                                ? 'text-muted-foreground/30 cursor-not-allowed opacity-30'
                                : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        {cell.day}
                        {isTodayCell && !isSel ? <div className="w-1 h-1 rounded-full bg-primary mt-0.5" /> : null}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-2 pt-2 border-t border-border">
                  <button
                    onClick={() => {
                      setSelectedDate(today);
                      setShowCalendar(false);
                    }}
                    className="flex-1 text-xs py-1.5 rounded-xl bg-primary/10 text-primary font-medium hover:bg-primary/20 thea-transition-fast"
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
                    className="flex-1 text-xs py-1.5 rounded-xl bg-muted text-muted-foreground font-medium hover:bg-muted/80 thea-transition-fast"
                  >
                    {tr('أمس', 'Yesterday')}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Past date banner ── */}
      {isPast ? (
        <div className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800/30 px-4 py-2.5 thea-transition-fast">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {tr('عرض بيانات تاريخية ليوم', 'Showing historical data for')} <strong>{formatDateLabel(selectedDate, language)}</strong> — {tr('الإجراءات معطّلة', 'actions are disabled')}
              </span>
            </div>
            <button onClick={() => setSelectedDate(today)} className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 underline thea-transition-fast">
              {tr('العودة لليوم', 'Back to today')}
            </button>
          </div>
        </div>
      ) : null}

      <div className="max-w-[1400px] mx-auto px-4 py-4 space-y-4">
        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
          <TheaKpiCard icon={<ClipboardList className="w-5 h-5" />} label={tr('الإجمالي', 'Total')} value={total} />
          <TheaKpiCard icon={<CheckCircle2 className="w-5 h-5" />} label={tr('تم الحضور', 'Checked in')} value={checkedIn} color="#10B981" />
          <TheaKpiCard icon={<Bell className="w-5 h-5" />} label={tr('لم يصل', 'No-show')} value={notCheckedIn} color="#8B5CF6" />
          <TheaKpiCard icon={<Clock className="w-5 h-5" />} label={tr('ينتظر', 'Waiting')} value={waiting} color="#F59E0B" />
          <TheaKpiCard icon={<MessageSquare className="w-5 h-5" />} label={tr('قيد التنفيذ', 'In progress')} value={inProgress} color="#3B82F6" />
          <TheaKpiCard icon={<Flag className="w-5 h-5" />} label={tr('مكتمل', 'Completed')} value={completed} color="#10B981" />
          {pendingPayment > 0 ? (
            <TheaKpiCard icon={<Banknote className="w-5 h-5" />} label={tr('بانتظار الدفع', 'Pending pay')} value={pendingPayment} color="#D97706" />
          ) : (
            <TheaKpiCard icon={<AlertOctagon className="w-5 h-5" />} label={tr('انتظار طويل', 'Long wait')} value={longWait} color="#EF4444" />
          )}
        </div>

        {/* ── Filter bar ── */}
        <div className="bg-card rounded-2xl border border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tr('ابحث باسم المريض أو رقم الملف...', 'Search by patient name or MRN...')}
                className="w-full pl-9 pr-3 py-2 rounded-xl border-[1.5px] border-border bg-muted/30 text-[13px] outline-none thea-input-focus thea-transition-fast"
              />
            </div>

            <select
              value={filterClinic}
              onChange={(e) => setFilterClinic(e.target.value)}
              className="px-3 py-2 rounded-xl border-[1.5px] border-border bg-muted/30 text-[13px] outline-none thea-input-focus thea-transition-fast"
            >
              <option value="ALL">{tr('جميع العيادات', 'All clinics')}</option>
              {clinics.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <div className="flex gap-1 overflow-x-auto">
              {[
                { key: 'ALL', label: tr('الكل', 'All') },
                { key: 'NOT_CHECKED_IN', label: tr('لم يحضر', 'No-show') },
                { key: 'WAITING', label: tr('ينتظر', 'Waiting') },
                { key: 'IN_PROGRESS', label: tr('قيد التنفيذ', 'In progress') },
                ...(pendingPayment > 0 ? [{ key: 'PENDING_PAYMENT', label: `${tr('بانتظار الدفع', 'Pending pay')} (${pendingPayment})` }] : []),
              ].map((opt) => (
                <TheaTab
                  key={opt.key}
                  label={opt.label}
                  active={filterStatus === opt.key}
                  onClick={() => setFilterStatus(opt.key)}
                />
              ))}
            </div>

            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary"
              />
              {tr('إظهار المكتمل', 'Show completed')}
            </label>
          </div>
        </div>

        {/* ── Desktop: div-based rows ── */}
        <div className="hidden md:block bg-card rounded-2xl border border-border overflow-x-auto">
          <div className="min-w-[880px]">
          {/* Header row */}
          <div className="grid grid-cols-[2fr_1fr_1fr_auto_auto_auto_auto_140px] gap-3 px-4 py-3 bg-muted/30 border-b border-border">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{tr('المريض', 'Patient')}</span>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{tr('العيادة', 'Clinic')}</span>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{tr('الطبيب', 'Doctor')}</span>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider min-w-[110px]">{tr('وقت الموعد', 'Appt. time')}</span>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider min-w-[100px]">{tr('الحالة', 'Status')}</span>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider min-w-[100px]">{tr('التقدم', 'Progress')}</span>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider min-w-[70px]">{tr('الانتظار', 'Wait')}</span>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-[140px] text-right shrink-0">{tr('إجراء', 'Action')}</span>
          </div>

          {/* Empty state */}
          {!filtered.length && !isValidating ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center"><Building2 className="w-7 h-7 text-muted-foreground" /></div>
              <div className="text-sm font-medium text-muted-foreground">{tr('لا يوجد مرضى يطابقون الفلتر', 'No patients match the filter')}</div>
              <div className="text-xs text-muted-foreground/60">{tr('جرّب تغيير العيادة أو فلتر الحالة', 'Try changing clinic or status filter')}</div>
            </div>
          ) : (
            filtered.map((item: any) => {
              const status = getResolvedStatus(item);
              const cfg = OPD_STATUS_CONFIG[status] || DEFAULT_STATUS;
              const vt = getVisitTypeConfig(item.visitType);
              const notChecked = !item.checkedInAt;

              return (
                <div
                  key={item.bookingId}
                  className={`grid grid-cols-[2fr_1fr_1fr_auto_auto_auto_auto_140px] gap-3 px-4 py-3 border-b border-border last:border-0 thea-hover-lift thea-transition-fast items-center group ${
                    notChecked ? 'bg-purple-50/30 dark:bg-purple-950/10' : ''
                  }`}
                >
                  {/* Avatar + name */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ background: item.patient?.gender === 'MALE' ? 'linear-gradient(135deg, #6693f5, #3366e6)' : 'linear-gradient(135deg, #e882b4, #d63384)' }}
                    >
                      {(item.patient?.fullName || '?')[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{item.patient?.fullName || 'Unknown'}</div>
                      <div className="text-[11px] text-muted-foreground">{item.patient?.mrn || '—'} · {getAge(item.patient?.dob)}y {item.patient?.gender === 'MALE' ? 'M' : 'F'}</div>
                    </div>
                  </div>
                  {/* Clinic */}
                  <div className="text-sm text-foreground min-w-[80px]">{item.clinicName || '—'}</div>
                  {/* Doctor */}
                  <div className="text-sm text-muted-foreground min-w-[80px]">{item.doctorName || '—'}</div>
                  {/* Time + visit type + source (موعد/انتظار) */}
                  <div className="min-w-[110px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-foreground">{formatTime(item.startAt, language)}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${vt.color}`}>{language === 'en' && vt.labelEn ? vt.labelEn : vt.label}</span>
                      {item.sourceType ? (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getSourceTypeConfig(item.sourceType).color}`}>
                          {language === 'en' ? getSourceTypeConfig(item.sourceType).labelEn : getSourceTypeConfig(item.sourceType).label}
                        </span>
                      ) : item.bookingTypeLabel === 'WALK_IN' ? (
                        <span className="text-[10px] text-orange-500 font-medium">{tr('انتظار', 'Walk-in')}</span>
                      ) : null}
                    </div>
                  </div>
                  {/* Status */}
                  <div className="min-w-[100px]">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${cfg.bg} ${cfg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {language === 'en' && cfg.labelEn ? cfg.labelEn : cfg.label}
                      </span>
                      {item.isPendingPayment && status !== 'PENDING_PAYMENT' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 animate-pulse">
                          <Banknote className="w-3 h-3" /> {tr('يحتاج دفع', 'Needs payment')}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Flow progress */}
                  <div className="min-w-[100px]">
                    <FlowProgress step={cfg.step} />
                  </div>
                  {/* Wait time */}
                  <div className="min-w-[70px]">
                    <span className={`text-sm ${getWaitColor(item.waitingSinceMinutes)}`}>
                      {formatWait(item.waitingSinceMinutes, language)}
                    </span>
                  </div>
                  {/* Actions */}
                  <div className="w-[140px] text-right shrink-0">
                    {item.isPendingPayment && !isPast ? (
                      <div className="flex items-center gap-1.5 justify-end">
                        {item.pendingOrdersCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            <Banknote className="w-3 h-3" /> {item.pendingOrdersCount} {tr('طلبات', 'orders')}
                          </span>
                        ) : null}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmPaymentItem(item);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 thea-transition-fast shadow-sm"
                        >
                          ✓ {tr('تأكيد الدفع', 'Confirm pay')}
                        </button>
                      </div>
                    ) : notChecked && !isPast ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCheckInItem(item);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 thea-transition-fast shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> {tr('تسجيل حضور', 'Check in')}
                      </button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
          </div>
        </div>

        {/* ── Mobile cards ── */}
        <div className="md:hidden space-y-2">
          {!filtered.length && !isValidating ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><Building2 className="w-7 h-7 text-muted-foreground" /></div>
              <div className="text-sm font-medium text-muted-foreground">{tr('لا يوجد مرضى يطابقون الفلتر', 'No patients match the filter')}</div>
            </div>
          ) : (
            filtered.map((item: any) => {
              const status = getResolvedStatus(item);
              const cfg = OPD_STATUS_CONFIG[status] || DEFAULT_STATUS;
              const notChecked = !item.checkedInAt;

              return (
                <div
                  key={item.bookingId}
                  className={`rounded-2xl border bg-card p-3 thea-hover-lift thea-transition-fast ${
                    notChecked ? 'border-purple-200 dark:border-purple-800/30 bg-purple-50/30 dark:bg-purple-950/10' : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: item.patient?.gender === 'MALE' ? 'linear-gradient(135deg, #6693f5, #3366e6)' : 'linear-gradient(135deg, #e882b4, #d63384)' }}
                      >
                        {(item.patient?.fullName || '?')[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">{item.patient?.fullName}</div>
                        <div className="text-[10px] text-muted-foreground">{item.patient?.mrn} · {getAge(item.patient?.dob)}y</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {language === 'en' && cfg.labelEn ? cfg.labelEn : cfg.label}
                      </span>
                      {item.isPendingPayment && status !== 'PENDING_PAYMENT' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 animate-pulse">
                          <Banknote className="w-3 h-3" /> {tr('يحتاج دفع', 'Needs payment')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-2">
                    <span className="inline-flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {item.clinicName}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatTime(item.startAt, language)}</span>
                    {item.sourceType ? (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getSourceTypeConfig(item.sourceType).color}`}>
                        {language === 'en' ? getSourceTypeConfig(item.sourceType).labelEn : getSourceTypeConfig(item.sourceType).label}
                      </span>
                    ) : null}
                    {item.waitingSinceMinutes !== null ? (
                      <span className={`inline-flex items-center gap-1 ${getWaitColor(item.waitingSinceMinutes)}`}><Timer className="w-3.5 h-3.5" /> {formatWait(item.waitingSinceMinutes, language)}</span>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex-1 mr-3">
                      <FlowProgress step={cfg.step} />
                    </div>
                    {item.isPendingPayment && !isPast ? (
                      <div className="flex items-center gap-1.5">
                        {item.pendingOrdersCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                            <Banknote className="w-3 h-3" /> {item.pendingOrdersCount}
                          </span>
                        ) : null}
                        <button
                          onClick={() => setConfirmPaymentItem(item)}
                          className="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-[11px] font-bold thea-transition-fast"
                        >
                          ✓ {tr('تأكيد الدفع', 'Confirm pay')}
                        </button>
                      </div>
                    ) : notChecked && !isPast ? (
                      <button
                        onClick={() => setCheckInItem(item)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary text-white text-[11px] font-bold thea-transition-fast"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> {tr('تسجيل حضور', 'Check in')}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer stats bar ── */}
        <div className="bg-card rounded-2xl border border-border px-4 py-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {tr('عرض', 'Showing')} <strong className="text-foreground">{filtered.length}</strong> {tr('من', 'of')} {total} {tr('مريض', 'patients')}
            {filterClinic !== 'ALL'
              ? language === 'ar'
                ? ` في ${clinics.find((c: any) => c.id === filterClinic)?.name || filterClinic}`
                : ` in ${clinics.find((c: any) => c.id === filterClinic)?.name || filterClinic}`
              : ''}
          </span>
          <span className="text-muted-foreground/60">
            {isToday
              ? `${tr('آخر تحديث', 'Last refresh')}: ${lastRefresh ? lastRefresh.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}`
              : `${language === 'ar' ? 'عرض' : 'Viewing'} ${formatDateLabel(selectedDate, language)}`}
          </span>
        </div>
      </div>

      {/* ── Check-in confirmation dialog ── */}
      {checkInItem ? (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setCheckInItem(null)}>
          <div className="thea-animate-slide-up bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold text-white mx-auto mb-3"
                style={{ background: checkInItem.patient?.gender === 'MALE' ? 'linear-gradient(135deg, #6693f5, #3366e6)' : 'linear-gradient(135deg, #e882b4, #d63384)' }}
              >
                {(checkInItem.patient?.fullName || '?')[0]}
              </div>
              <h3 className="text-lg font-bold text-foreground">{checkInItem.patient?.fullName}</h3>
              <p className="text-sm text-muted-foreground">
                {checkInItem.patient?.mrn} · {getAge(checkInItem.patient?.dob)}y
              </p>
            </div>

            <div className="bg-muted/50 rounded-xl p-3 mb-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{tr('العيادة', 'Clinic')}</span>
                <span className="font-medium text-foreground">{checkInItem.clinicName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{tr('الطبيب', 'Doctor')}</span>
                <span className="font-medium text-foreground">{checkInItem.doctorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{tr('الموعد', 'Appointment')}</span>
                <span className="font-medium text-foreground">{formatTime(checkInItem.startAt, language)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{tr('النوع', 'Type')}</span>
                <span className="font-medium text-foreground flex flex-wrap items-center gap-1.5">
                  {(() => {
                    const vt = getVisitTypeConfig(checkInItem.visitType);
                    return language === 'en' && vt.labelEn ? vt.labelEn : vt.label;
                  })()}
                  {checkInItem.sourceType ? (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getSourceTypeConfig(checkInItem.sourceType).color}`}>
                      {language === 'en' ? getSourceTypeConfig(checkInItem.sourceType).labelEn : getSourceTypeConfig(checkInItem.sourceType).label}
                    </span>
                  ) : null}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setCheckInItem(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted thea-transition-fast"
              >
                {tr('إلغاء', 'Cancel')}
              </button>
              <button
                onClick={() => handleCheckIn(checkInItem)}
                disabled={checkingIn}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 thea-transition-fast disabled:opacity-50 shadow-sm"
              >
                {checkingIn ? tr('جاري التسجيل...', 'Checking in...') : <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> {tr('تأكيد الحضور', 'Confirm check-in')}</span>}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Confirm payment dialog ── */}
      {confirmPaymentItem ? (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setConfirmPaymentItem(null)}>
          <div className="thea-animate-slide-up bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mx-auto mb-3">
                <Banknote className="w-7 h-7 text-amber-700 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-foreground">{tr('تأكيد الدفع', 'Confirm Payment')}</h3>
              <p className="text-sm text-muted-foreground">
                {confirmPaymentItem.patient?.fullName} · {confirmPaymentItem.patient?.mrn}
              </p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-3 mb-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{tr('العيادة', 'Clinic')}</span>
                <span className="font-medium text-foreground">{confirmPaymentItem.clinicName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{tr('الطبيب', 'Doctor')}</span>
                <span className="font-medium text-foreground">{confirmPaymentItem.doctorName}</span>
              </div>
              {confirmPaymentItem.pendingOrdersCount > 0 ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{tr('طلبات معلقة', 'Pending orders')}</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400">{confirmPaymentItem.pendingOrdersCount}</span>
                </div>
              ) : null}
            </div>

            <p className="text-xs text-muted-foreground text-center mb-4">
              {tr('سيتم تحويل حالة المريض إلى مكتمل بعد تأكيد الدفع', 'Patient status will be set to completed after confirming payment')}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setConfirmPaymentItem(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted thea-transition-fast"
              >
                {tr('إلغاء', 'Cancel')}
              </button>
              <button
                onClick={() => handleConfirmPayment(confirmPaymentItem)}
                disabled={confirmingPayment}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 thea-transition-fast disabled:opacity-50 shadow-sm"
              >
                {confirmingPayment ? tr('جاري التأكيد...', 'Confirming...') : `✓ ${tr('تأكيد الدفع', 'Confirm payment')}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
