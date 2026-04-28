'use client';

// =============================================================================
// IPDWardBoard — Ward whiteboard / census view
// =============================================================================

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BedDouble,
  Search,
  RefreshCw,
  User,
  Activity,
  AlertCircle,
  Utensils,
  ShieldAlert,
  AlertTriangle,
  ClipboardList,
  Clock,
  Stethoscope,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

// ── Status configuration ─────────────────────────────────────────────────────
type BedStatus = 'EMPTY' | 'OCCUPIED' | 'DISCHARGE_READY' | 'RESERVED';

const STATUS_CONFIG: Record<BedStatus, {
  labelAr: string;
  labelEn: string;
  bg: string;
  border: string;
  text: string;
  dot: string;
  badgeVariant: string;
}> = {
  EMPTY: {
    labelAr: 'شاغر',
    labelEn: 'Available',
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-300 dark:border-green-700',
    text: 'text-green-700 dark:text-green-300',
    dot: 'bg-green-500',
    badgeVariant: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  },
  OCCUPIED: {
    labelAr: 'مشغول',
    labelEn: 'Occupied',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-300 dark:border-blue-700',
    text: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
    badgeVariant: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  },
  DISCHARGE_READY: {
    labelAr: 'جاهز للخروج',
    labelEn: 'Discharge Ready',
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-300 dark:border-yellow-700',
    text: 'text-yellow-700 dark:text-yellow-300',
    dot: 'bg-yellow-500',
    badgeVariant: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  },
  RESERVED: {
    labelAr: 'محجوز',
    labelEn: 'Reserved',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    border: 'border-orange-300 dark:border-orange-700',
    text: 'text-orange-700 dark:text-orange-300',
    dot: 'bg-orange-500',
    badgeVariant: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizeBedStatus(raw: string | null | undefined): BedStatus {
  const s = String(raw || '').toUpperCase().replace(/[\s-]/g, '_');
  if (s === 'OCCUPIED') return 'OCCUPIED';
  if (s === 'DISCHARGE_READY') return 'DISCHARGE_READY';
  if (s === 'RESERVED') return 'RESERVED';
  if (s === 'VACANT' || s === 'EMPTY' || s === 'AVAILABLE') return 'EMPTY';
  // If bed has an admission, treat as occupied
  return 'EMPTY';
}

function losText(admissionDate: string | null): string {
  if (!admissionDate) return '---';
  const diff = Date.now() - new Date(admissionDate).getTime();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '---';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// =============================================================================
// Component
// =============================================================================
export default function IPDWardBoard() {
  const { language } = useLang();
  const isAr = language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);

  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeWard, setActiveWard] = useState('__all__');

  // ── Data fetching ──────────────────────────────────────────────────────────
  const url =
    activeWard === '__all__'
      ? '/api/ipd/live-beds'
      : `/api/ipd/live-beds?departmentId=${activeWard}`;

  const { data, isLoading, mutate } = useSWR(url, fetcher, { refreshInterval: 15000 });

  const allBeds: any[] = data?.beds || [];
  const departments: any[] = data?.departments || [];

  // ── Derive bed status from API data ────────────────────────────────────────
  const enrichedBeds = useMemo(() => {
    return allBeds.map((bed: any) => {
      let status: BedStatus;
      if (bed.admission) {
        const epStatus = String(bed.admission?.episodeStatus || bed.admission?.status || '').toUpperCase();
        if (epStatus === 'DISCHARGE_READY') {
          status = 'DISCHARGE_READY';
        } else {
          status = 'OCCUPIED';
        }
      } else if (String(bed.status || '').toUpperCase() === 'RESERVED') {
        status = 'RESERVED';
      } else {
        status = normalizeBedStatus(bed.status);
      }
      return { ...bed, derivedStatus: status };
    });
  }, [allBeds]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = enrichedBeds.length;
    const occupied = enrichedBeds.filter(b => b.derivedStatus === 'OCCUPIED').length;
    const available = enrichedBeds.filter(b => b.derivedStatus === 'EMPTY').length;
    const dischargeReady = enrichedBeds.filter(b => b.derivedStatus === 'DISCHARGE_READY').length;
    const reserved = enrichedBeds.filter(b => b.derivedStatus === 'RESERVED').length;
    return { total, occupied, available, dischargeReady, reserved };
  }, [enrichedBeds]);

  // ── Search filter ──────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const filteredBeds = useMemo(() => {
    if (!q) return enrichedBeds;
    return enrichedBeds.filter(
      (bed: any) =>
        (bed.bedLabel || '').toLowerCase().includes(q) ||
        (bed.admission?.patientName || '').toLowerCase().includes(q) ||
        (bed.admission?.mrn || '').toLowerCase().includes(q) ||
        (bed.room || '').toLowerCase().includes(q)
    );
  }, [enrichedBeds, q]);

  // ── Group by department ────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    filteredBeds.forEach((bed: any) => {
      const dept = bed.departmentName || tr('غير محدد', 'Unassigned');
      if (!map[dept]) map[dept] = [];
      map[dept].push(bed);
    });
    return map;
  }, [filteredBeds]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-indigo-500" />
            {tr('لوحة الأجنحة', 'Ward Whiteboard')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr(
              'إحصاء الأسرة والمرضى بالوقت الفعلي — تحديث كل ١٥ ثانية',
              'Real-time bed census & patient overview — auto-refresh every 15s'
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          {tr('تحديث', 'Refresh')}
        </Button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: tr('إجمالي الأسرة', 'Total Beds'),
            value: stats.total,
            color: 'text-foreground',
            icon: BedDouble,
            iconColor: 'text-indigo-500',
          },
          {
            label: tr('مشغولة', 'Occupied'),
            value: stats.occupied,
            color: 'text-blue-600',
            icon: User,
            iconColor: 'text-blue-500',
          },
          {
            label: tr('شاغرة', 'Available'),
            value: stats.available,
            color: 'text-green-600',
            icon: Activity,
            iconColor: 'text-green-500',
          },
          {
            label: tr('جاهز للخروج', 'Discharge Ready'),
            value: stats.dischargeReady,
            color: 'text-yellow-600',
            icon: AlertCircle,
            iconColor: 'text-yellow-500',
          },
        ].map((kpi, i) => (
          <Card key={i} className="border border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className={`h-4 w-4 ${kpi.iconColor}`} />
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
              </div>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + Ward Tabs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={tr('بحث بالمريض أو رقم السجل أو السرير...', 'Search by patient, MRN, or bed...')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Ward filter tabs */}
      {departments.length > 0 && (
        <Tabs value={activeWard} onValueChange={setActiveWard}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="__all__">{tr('الكل', 'All')}</TabsTrigger>
            {departments.map((d: any) => (
              <TabsTrigger key={d.id} value={d.id}>
                {d.name || d.code}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filteredBeds.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          {tr('لا توجد أسرة مطابقة', 'No beds match your search')}
        </div>
      )}

      {/* Bed grid by department */}
      {!isLoading &&
        Object.entries(grouped).map(([dept, beds]) => (
          <div key={dept} className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <BedDouble className="h-4 w-4 text-muted-foreground" />
              {dept}
              <span className="text-xs font-normal text-muted-foreground">
                ({beds.length} {tr('سرير', 'beds')})
              </span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {beds.map((bed: any) => {
                const status: BedStatus = bed.derivedStatus;
                const cfg = STATUS_CONFIG[status];
                const adm = bed.admission;

                return (
                  <Card
                    key={bed.id}
                    className={`border-2 ${cfg.border} ${cfg.bg} transition hover:shadow-md ${adm?.episodeId ? 'cursor-pointer' : ''}`}
                    onClick={() => {
                      if (adm?.episodeId) {
                        router.push(`/ipd/episode/${adm.episodeId}`);
                      }
                    }}
                  >
                    <CardContent className="p-3 space-y-2">
                      {/* Top row: bed label + status badge */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
                          <span className={`font-bold text-sm ${cfg.text}`}>
                            {bed.bedLabel || bed.id}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cfg.badgeVariant}`}
                        >
                          {isAr ? cfg.labelAr : cfg.labelEn}
                        </span>
                      </div>

                      {/* Room info */}
                      {bed.room && (
                        <p className="text-[10px] text-muted-foreground">
                          {tr('غرفة', 'Room')} {bed.room}
                        </p>
                      )}

                      {/* Patient info (occupied / discharge ready) */}
                      {adm ? (
                        <div className="space-y-1.5">
                          {/* Patient name + MRN */}
                          <div>
                            <p className="text-xs font-semibold text-foreground truncate flex items-center gap-1">
                              <User className="h-3 w-3 shrink-0" />
                              {adm.patientName || '---'}
                            </p>
                            {adm.mrn && (
                              <p className="text-[10px] text-muted-foreground ml-4">
                                MRN: {adm.mrn}
                              </p>
                            )}
                          </div>

                          {/* Attending physician */}
                          {adm.doctorName && (
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1 truncate">
                              <Stethoscope className="h-3 w-3 shrink-0" />
                              {adm.doctorName}
                            </p>
                          )}

                          {/* Admission date + LOS */}
                          {adm.admissionDate && (
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <Clock className="h-3 w-3 shrink-0" />
                              <span>{fmtDate(adm.admissionDate)}</span>
                              <span className="font-medium text-muted-foreground">
                                LOS: {losText(adm.admissionDate)}
                              </span>
                            </div>
                          )}

                          {/* Icons row: diet, isolation, fall risk, tasks */}
                          <div className="flex items-center gap-2 pt-1">
                            {adm.diet && (
                              <span
                                title={tr('نظام غذائي خاص', 'Special Diet')}
                                className="text-amber-500"
                              >
                                <Utensils className="h-3.5 w-3.5" />
                              </span>
                            )}
                            {adm.isolation && (
                              <span
                                title={tr('عزل', 'Isolation')}
                                className="text-red-500"
                              >
                                <ShieldAlert className="h-3.5 w-3.5" />
                              </span>
                            )}
                            {adm.fallRisk && (
                              <span
                                title={tr('خطر سقوط', 'Fall Risk')}
                                className="text-orange-500"
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                              </span>
                            )}
                            {(adm.tasksCount ?? 0) > 0 && (
                              <Badge
                                variant="secondary"
                                className="text-[9px] px-1 py-0 h-4"
                              >
                                {adm.tasksCount} {tr('مهام', 'tasks')}
                              </Badge>
                            )}
                            {(adm.alertsCount ?? 0) > 0 && (
                              <Badge
                                variant="destructive"
                                className="text-[9px] px-1 py-0 h-4"
                              >
                                {adm.alertsCount} {tr('تنبيهات', 'alerts')}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Empty bed */
                        <div className="py-3 text-center">
                          <p className="text-xs font-medium text-green-600 dark:text-green-400">
                            {tr('شاغر', 'Available')}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
        {(Object.keys(STATUS_CONFIG) as BedStatus[]).map(key => {
          const c = STATUS_CONFIG[key];
          return (
            <span key={key} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
              {isAr ? c.labelAr : c.labelEn}
            </span>
          );
        })}
        <span className="flex items-center gap-1.5 text-amber-500">
          <Utensils className="h-3 w-3" /> {tr('نظام غذائي', 'Diet')}
        </span>
        <span className="flex items-center gap-1.5 text-red-500">
          <ShieldAlert className="h-3 w-3" /> {tr('عزل', 'Isolation')}
        </span>
        <span className="flex items-center gap-1.5 text-orange-500">
          <AlertTriangle className="h-3 w-3" /> {tr('خطر سقوط', 'Fall Risk')}
        </span>
      </div>
    </div>
  );
}
