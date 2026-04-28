'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useLang } from '@/hooks/use-lang';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import {
  Calendar as CalendarIcon,
  Search,
  RefreshCw,
  Filter,
  CheckCircle2,
  Clock,
  Ban,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

const DISPLAY_TZ = 'Asia/Riyadh' as const;
const PAGE_SIZE = 25;

type Appointment = {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  resourceId: string;
  resourceName: string;
  reservationType: string;
  status: string;
  startAt: string;
  endAt: string;
  notes?: string;
  specialtyCode?: string | null;
  clinicId?: string | null;
};

const STATUS_FILTERS = [
  { value: 'ALL', ar: 'الكل', en: 'All' },
  { value: 'ACTIVE', ar: 'نشط', en: 'Active' },
  { value: 'CANCELLED', ar: 'ملغي', en: 'Cancelled' },
  { value: 'EXPIRED', ar: 'منتهي', en: 'Expired' },
];

const TYPE_FILTERS = [
  { value: 'ALL', ar: 'كل الأنواع', en: 'All Types' },
  { value: 'BOOKING', ar: 'حجز', en: 'Booking' },
  { value: 'HOLD', ar: 'احتفاظ', en: 'Hold' },
];

function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayDate(): string {
  return toDateOnly(new Date());
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  return toDateOnly(dt);
}

function formatRange(startAt: string, endAt: string, language: 'ar' | 'en') {
  if (!startAt) return '—';
  const s = new Date(startAt);
  const e = endAt ? new Date(endAt) : null;
  if (Number.isNaN(s.getTime())) return '—';
  const opts: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: DISPLAY_TZ,
  };
  const sStr = new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : 'en-GB', opts).format(s);
  const eStr = e && !Number.isNaN(e.getTime())
    ? new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : 'en-GB', opts).format(e)
    : '';
  return eStr ? `${sStr} – ${eStr}` : sStr;
}

function formatDate(startAt: string, language: 'ar' | 'en') {
  if (!startAt) return '—';
  const s = new Date(startAt);
  if (Number.isNaN(s.getTime())) return '—';
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: DISPLAY_TZ,
  }).format(s);
}

function statusVariant(status: string, type: string) {
  if (status === 'CANCELLED') {
    return { ar: 'ملغي', en: 'Cancelled', cls: 'bg-rose-100 text-rose-700 border-rose-200', Icon: Ban };
  }
  if (status === 'EXPIRED') {
    return { ar: 'منتهي', en: 'Expired', cls: 'bg-slate-100 text-slate-600 border-slate-200', Icon: AlertCircle };
  }
  if (type === 'HOLD') {
    return { ar: 'احتفاظ', en: 'Hold', cls: 'bg-amber-100 text-amber-700 border-amber-200', Icon: Clock };
  }
  return { ar: 'محجوز', en: 'Booked', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', Icon: CheckCircle2 };
}

export default function SchedulingBoard() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { hasPermission, isLoading } = useRoutePermission('/scheduling/scheduling');

  const [startDate, setStartDate] = useState<string>(todayDate());
  const [endDate, setEndDate] = useState<string>(addDays(todayDate(), 6));
  const [resourceId, setResourceId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(0);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const resourcesUrl = hasPermission ? '/api/scheduling/resources' : null;
  const { data: resourcesData } = useSWR(resourcesUrl, fetcher);
  const resources = Array.isArray(resourcesData?.items) ? resourcesData.items : [];

  const apptUrl = useMemo(() => {
    if (!hasPermission) return null;
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (resourceId !== 'ALL') params.set('resourceId', resourceId);
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    return `/api/scheduling/appointments?${params.toString()}`;
  }, [hasPermission, startDate, endDate, resourceId, statusFilter]);

  const { data: apptData, mutate: refetch, isValidating } = useSWR(apptUrl, fetcher);
  const appointments: Appointment[] = useMemo(
    () => (Array.isArray(apptData?.items) ? apptData.items : []),
    [apptData],
  );

  const filtered = useMemo(() => {
    let items = appointments;
    if (typeFilter !== 'ALL') {
      items = items.filter((a) => a.reservationType === typeFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter((a) => {
        const patient = (a.patientName || '').toLowerCase();
        const resource = (a.resourceName || '').toLowerCase();
        const phone = (a.patientPhone || '').toLowerCase();
        return patient.includes(q) || resource.includes(q) || phone.includes(q);
      });
    }
    return items;
  }, [appointments, typeFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page],
  );

  const counts = useMemo(() => {
    const c = { active: 0, hold: 0, cancelled: 0, total: appointments.length };
    appointments.forEach((a) => {
      if (a.status === 'CANCELLED') c.cancelled += 1;
      else if (a.reservationType === 'HOLD') c.hold += 1;
      else c.active += 1;
    });
    return c;
  }, [appointments]);

  const onCancel = async (apt: Appointment) => {
    if (!apt?.id) return;
    if (apt.status !== 'ACTIVE') return;
    if (!window.confirm(tr('إلغاء هذا الموعد؟', 'Cancel this appointment?'))) return;
    setCancellingId(apt.id);
    try {
      const res = await fetch(`/api/scheduling/reservations/${apt.id}/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled from scheduling board' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'cancel-failed');
      }
      toast({ title: tr('تم إلغاء الموعد', 'Appointment cancelled') });
      refetch();
    } catch (err: any) {
      toast({
        title: tr('تعذر الإلغاء', 'Cancel failed'),
        description: String(err?.message || err),
        variant: 'destructive',
      });
    } finally {
      setCancellingId(null);
    }
  };

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) {
    return (
      <div className="p-6">
        <Card className="rounded-2xl p-6 text-sm text-muted-foreground">
          {tr('الوصول للجدولة مقيّد.', 'Scheduling access is restricted.')}
        </Card>
      </div>
    );
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="container mx-auto p-4 md:p-6 max-w-7xl space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-muted-foreground" />
            {tr('لوحة الجدولة', 'Scheduling Board')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr(
              'كل المواعيد عبر الموارد والعيادات والأطباء',
              'All appointments across resources, clinics, and providers',
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isValidating}
          >
            <RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} />
            <span className="ml-2">{tr('تحديث', 'Refresh')}</span>
          </Button>
          <Link href="/opd/appointments/new">
            <Button size="sm">{tr('حجز جديد', 'New Booking')}</Button>
          </Link>
        </div>
      </div>

      <Card className="rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {tr('عوامل التصفية', 'Filters')}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <Label htmlFor="startDate" className="text-xs">{tr('من', 'From')}</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <div>
            <Label htmlFor="endDate" className="text-xs">{tr('إلى', 'To')}</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <div>
            <Label className="text-xs">{tr('المورد', 'Resource')}</Label>
            <Select value={resourceId} onValueChange={(v) => { setResourceId(v); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{tr('كل الموارد', 'All Resources')}</SelectItem>
                {resources.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.displayName || r.nameEn || r.nameAr || r.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{tr('الحالة', 'Status')}</Label>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{tr(s.ar, s.en)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{tr('النوع', 'Type')}</Label>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPE_FILTERS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{tr(t.ar, t.en)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="search" className="text-xs">{tr('بحث', 'Search')}</Label>
            <div className="relative">
              <Search className="absolute top-1/2 -translate-y-1/2 left-2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                placeholder={tr('اسم المريض أو المورد', 'Patient or resource')}
                className="pl-8"
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="rounded-2xl p-4">
          <div className="text-xs text-muted-foreground">{tr('الإجمالي', 'Total')}</div>
          <div className="text-2xl font-extrabold mt-0.5">{counts.total}</div>
        </Card>
        <Card className="rounded-2xl p-4">
          <div className="text-xs text-muted-foreground">{tr('المؤكدة', 'Booked')}</div>
          <div className="text-2xl font-extrabold mt-0.5 text-emerald-700">{counts.active}</div>
        </Card>
        <Card className="rounded-2xl p-4">
          <div className="text-xs text-muted-foreground">{tr('قيد الاحتفاظ', 'On Hold')}</div>
          <div className="text-2xl font-extrabold mt-0.5 text-amber-700">{counts.hold}</div>
        </Card>
        <Card className="rounded-2xl p-4">
          <div className="text-xs text-muted-foreground">{tr('الملغية', 'Cancelled')}</div>
          <div className="text-2xl font-extrabold mt-0.5 text-rose-700">{counts.cancelled}</div>
        </Card>
      </div>

      <Card className="rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold">
            {tr('قائمة المواعيد', 'Appointment List')}
            <span className="text-muted-foreground font-normal ms-2">
              ({filtered.length})
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {tr('الصفحة', 'Page')} {page + 1} / {totalPages}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            {isValidating
              ? tr('جاري التحميل...', 'Loading...')
              : tr('لا توجد مواعيد ضمن عوامل التصفية الحالية.', 'No appointments match the current filters.')}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="text-start px-4 py-3">{tr('التاريخ', 'Date')}</th>
                    <th className="text-start px-4 py-3">{tr('الوقت', 'Time')}</th>
                    <th className="text-start px-4 py-3">{tr('المريض', 'Patient')}</th>
                    <th className="text-start px-4 py-3">{tr('المورد', 'Resource')}</th>
                    <th className="text-start px-4 py-3">{tr('الحالة', 'Status')}</th>
                    <th className="text-end px-4 py-3">{tr('إجراءات', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((apt) => {
                    const variant = statusVariant(apt.status, apt.reservationType);
                    const Icon = variant.Icon;
                    return (
                      <tr key={apt.id} className="border-t border-border thea-hover-lift">
                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(apt.startAt, language as any)}</td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                          {formatRange(apt.startAt, apt.endAt, language as any)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{apt.patientName || apt.patientId}</div>
                          {apt.patientPhone && (
                            <div className="text-xs text-muted-foreground">{apt.patientPhone}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{apt.resourceName}</div>
                          {apt.specialtyCode && (
                            <div className="text-xs text-muted-foreground">{apt.specialtyCode}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full text-[11px] font-bold px-2.5 py-0.5 border ${variant.cls}`}>
                            <Icon className="h-3 w-3" />
                            {tr(variant.ar, variant.en)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-end">
                          <div className="inline-flex items-center gap-1">
                            {apt.patientId && (
                              <Link href={`/patient/${apt.patientId}`}>
                                <Button variant="ghost" size="sm">{tr('المريض', 'Patient')}</Button>
                              </Link>
                            )}
                            {apt.status === 'ACTIVE' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={cancellingId === apt.id}
                                onClick={() => onCancel(apt)}
                              >
                                {cancellingId === apt.id
                                  ? tr('...جارٍ الإلغاء', 'Cancelling...')
                                  : tr('إلغاء', 'Cancel')}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-border flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                  <span className="ml-1">{tr('السابق', 'Previous')}</span>
                </Button>
                <div className="text-xs text-muted-foreground">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} / {filtered.length}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  <span className="mr-1">{tr('التالي', 'Next')}</span>
                  {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
