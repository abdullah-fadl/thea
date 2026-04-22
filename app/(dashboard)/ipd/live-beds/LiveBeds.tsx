'use client';

// =============================================================================
// LiveBeds — Real-time bed occupancy dashboard
// =============================================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import {
  BedDouble,
  User,
  Activity,
  ChevronDown,
  ChevronRight,
  Search,
  RefreshCw,
  Building2,
  AlertCircle,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

// ── Helpers ──────────────────────────────────────────────────────────────────
function statusColor(status: string) {
  switch (status) {
    case 'occupied': return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-700', dot: 'bg-blue-500' };
    case 'vacant':   return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', border: 'border-green-300 dark:border-green-700', dot: 'bg-green-500' };
    default:         return { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border', dot: 'bg-muted-foreground' };
  }
}

function occPercent(total: number, occupied: number) {
  return total > 0 ? Math.round((occupied / total) * 100) : 0;
}

function occColor(pct: number) {
  if (pct >= 90) return 'bg-red-500';
  if (pct >= 70) return 'bg-amber-500';
  return 'bg-green-500';
}

export default function LiveBeds() {
  const { language } = useLang();
  const isAr = language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);
  const router = useRouter();

  const [deptFilter, setDeptFilter] = useState('__all__');
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const url = deptFilter === '__all__'
    ? '/api/ipd/live-beds'
    : `/api/ipd/live-beds?departmentId=${deptFilter}`;

  const { data, isLoading, mutate } = useSWR(url, fetcher, { refreshInterval: 15000 });

  const stats = data?.statistics || { totalBeds: 0, occupiedBeds: 0, vacantBeds: 0, occupancyRate: 0 };
  const departments: any[] = data?.departments || [];
  const bedsByDept: Record<string, any[]> = data?.bedsByDepartment || {};

  // Search filter
  const q = search.trim().toLowerCase();
  const filteredDepts = Object.entries(bedsByDept)
    .map(([dept, beds]) => {
      const filtered = q
        ? beds.filter((b: any) =>
            (b.bedLabel || '').toLowerCase().includes(q) ||
            (b.admission?.patientName || '').toLowerCase().includes(q) ||
            (b.room || '').toLowerCase().includes(q)
          )
        : beds;
      return { dept, beds: filtered };
    })
    .filter(d => d.beds.length > 0);

  const toggle = (dept: string) => setCollapsed(p => ({ ...p, [dept]: !p[dept] }));

  // ── Render ──
  return (
    <div className="space-y-6 p-4">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BedDouble className="h-6 w-6 text-indigo-500" />
            {tr('الأسرّة المباشرة', 'Live Beds')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr('حالة إشغال الأسرة بالوقت الفعلي — تحديث كل ١٥ ثانية', 'Real-time bed occupancy — auto-refresh every 15s')}
          </p>
        </div>
        <button onClick={() => mutate()} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-muted/50 text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5" /> {tr('تحديث', 'Refresh')}
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: tr('إجمالي الأسرة', 'Total Beds'), value: stats.totalBeds, color: 'text-blue-600', icon: BedDouble },
          { label: tr('مشغولة', 'Occupied'), value: stats.occupiedBeds, color: 'text-red-600', icon: User },
          { label: tr('شاغرة', 'Vacant'), value: stats.vacantBeds, color: 'text-green-600', icon: Activity },
          { label: tr('نسبة الإشغال', 'Occupancy'), value: `${stats.occupancyRate}%`, color: stats.occupancyRate >= 90 ? 'text-red-600' : stats.occupancyRate >= 70 ? 'text-amber-600' : 'text-green-600', icon: AlertCircle },
        ].map((kpi, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              <span className="text-xs text-muted-foreground">{kpi.label}</span>
            </div>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-card focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            placeholder={tr('بحث بالسرير، المريض، أو الغرفة...', 'Search by bed, patient, or room...')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2 text-sm border border-border rounded-lg bg-card outline-none"
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
        >
          <option value="__all__">{tr('كل الأقسام', 'All Departments')}</option>
          {departments.map((d: any) => (
            <option key={d.id} value={d.id}>{d.name || d.code}</option>
          ))}
        </select>
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* ── Bed Grid by Department ── */}
      {!isLoading && filteredDepts.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          {tr('لا توجد أسرة مطابقة', 'No beds match your search')}
        </div>
      )}

      {!isLoading && filteredDepts.map(({ dept, beds }) => {
        const occ = beds.filter((b: any) => b.status === 'occupied').length;
        const vac = beds.length - occ;
        const pct = occPercent(beds.length, occ);
        const isCollapsed = collapsed[dept];

        return (
          <div key={dept} className="bg-card rounded-xl border border-border overflow-hidden">
            {/* Department header */}
            <button
              onClick={() => toggle(dept)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition"
            >
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <span className="font-semibold text-foreground">{dept}</span>
                <span className="text-xs text-muted-foreground">({beds.length} {tr('سرير', 'beds')})</span>
              </div>
              <div className="flex items-center gap-4">
                {/* Mini occupancy bar */}
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${occColor(pct)}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums w-10">{pct}%</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-blue-600 font-medium">{occ} {tr('مشغول', 'occ')}</span>
                  <span className="text-green-600 font-medium">{vac} {tr('شاغر', 'vac')}</span>
                </div>
                {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>

            {/* Bed cards grid */}
            {!isCollapsed && (
              <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {beds.map((bed: any) => {
                  const sc = statusColor(bed.status);
                  return (
                    <div
                      key={bed.id}
                      className={`rounded-lg border-2 ${sc.border} ${sc.bg} p-3 text-sm transition hover:shadow-md ${
                        bed.admission ? 'cursor-pointer' : ''
                      }`}
                      onClick={() => {
                        if (bed.admission?.patientId) {
                          router.push(`/patient-profile/${bed.admission.patientId}`);
                        }
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`h-2 w-2 rounded-full ${sc.dot}`} />
                        <span className={`font-bold ${sc.text}`}>{bed.bedLabel || bed.id}</span>
                      </div>
                      {bed.room && (
                        <p className="text-[10px] text-muted-foreground mb-1">{tr('غرفة', 'Room')} {bed.room}</p>
                      )}
                      {bed.admission ? (
                        <div className="mt-1 space-y-0.5">
                          <p className="text-xs font-medium text-foreground truncate">
                            {bed.admission.patientName || '---'}
                          </p>
                          {bed.admission.doctorName && (
                            <p className="text-[10px] text-muted-foreground truncate">
                              Dr. {bed.admission.doctorName}
                            </p>
                          )}
                          {bed.admission.diagnosis && (
                            <p className="text-[10px] text-muted-foreground truncate">
                              {bed.admission.diagnosis}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-[10px] text-green-600 dark:text-green-400 mt-1 font-medium">{tr('شاغر', 'Vacant')}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> {tr('مشغول', 'Occupied')}</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-500" /> {tr('شاغر', 'Vacant')}</span>
      </div>
    </div>
  );
}
