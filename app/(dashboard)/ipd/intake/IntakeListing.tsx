'use client';

// =============================================================================
// IntakeListing — IPD admission intake list
// =============================================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import {
  ClipboardList,
  Search,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
  User,
  Calendar,
  Activity,
  ArrowRight,
  Bed,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { labelEn: string; labelAr: string; color: string; bg: string }> = {
  ACTIVE:          { labelEn: 'Active',         labelAr: 'نشط',           color: 'text-green-700 dark:text-green-300', bg: 'bg-green-100 dark:bg-green-900/30' },
  DISCHARGE_READY: { labelEn: 'Discharge Ready', labelAr: 'جاهز للخروج',  color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  DISCHARGED:      { labelEn: 'Discharged',      labelAr: 'خرج',           color: 'text-muted-foreground',  bg: 'bg-muted' },
  TRANSFERRED:     { labelEn: 'Transferred',     labelAr: 'محوّل',         color: 'text-blue-700 dark:text-blue-300',  bg: 'bg-blue-100 dark:bg-blue-900/30' },
  DECEASED:        { labelEn: 'Deceased',        labelAr: 'متوفى',         color: 'text-foreground',  bg: 'bg-muted' },
};

function fmtDate(iso: string | null) {
  if (!iso) return '---';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function timeSince(iso: string | null) {
  if (!iso) return '---';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

// ── Date preset helper ────────────────────────────────────────────────────────
type DatePreset = 'today' | 'week' | 'month' | 'all';

function dateRange(preset: DatePreset): { from?: string; to?: string } {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (preset === 'today') {
    const today = iso(now);
    return { from: today, to: today };
  }
  if (preset === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return { from: iso(d) };
  }
  if (preset === 'month') {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return { from: iso(d) };
  }
  return {};
}

export default function IntakeListing() {
  const { language } = useLang();
  const isAr = language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);
  const router = useRouter();

  const [tab, setTab] = useState<'active' | 'all'>('active');
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');

  const statusFilter = tab === 'active' ? '&status=ACTIVE' : '';
  const searchQ = search.trim() ? `&q=${encodeURIComponent(search.trim())}` : '';
  const url = `/api/ipd/episodes?limit=200${statusFilter}${searchQ}`;

  const { data, isLoading, mutate } = useSWR(url, fetcher, { refreshInterval: 30000 });

  let items: any[] = data?.items || [];
  const total = data?.total || 0;

  // Client-side date preset filter (server returns all; we filter by createdAt)
  if (datePreset !== 'all') {
    const { from, to } = dateRange(datePreset);
    items = items.filter((it: any) => {
      const d = new Date(it.createdAt);
      if (from && d < new Date(from)) return false;
      if (to) {
        const toEnd = new Date(to);
        toEnd.setHours(23, 59, 59, 999);
        if (d > toEnd) return false;
      }
      return true;
    });
  }

  // Risk flag counts
  const highRisk = items.filter((it: any) => {
    const flags = it.riskFlags || {};
    return flags.fallRisk || flags.allergyAlert || flags.isolationRequired || flags.venousThromboembolism;
  }).length;

  const PRESETS: { value: DatePreset; labelAr: string; labelEn: string }[] = [
    { value: 'all',   labelAr: 'الكل',     labelEn: 'All' },
    { value: 'today', labelAr: 'اليوم',    labelEn: 'Today' },
    { value: 'week',  labelAr: 'هذا الأسبوع', labelEn: 'This Week' },
    { value: 'month', labelAr: 'هذا الشهر',  labelEn: 'This Month' },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4" dir={isAr ? 'rtl' : 'ltr'}>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-teal-500" />
            {tr('قائمة التنويم', 'IPD Intake')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr('جميع حلقات التنويم ومتابعة المرضى', 'All inpatient episodes and patient tracking')}
          </p>
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-muted/50 text-muted-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" /> {tr('تحديث', 'Refresh')}
        </button>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: tr('إجمالي الحلقات', 'Total Episodes'), value: total, color: 'text-blue-600', icon: ClipboardList },
          { label: tr('حالياً نشطة', 'Currently Active'), value: items.filter(i => i.status === 'ACTIVE').length, color: 'text-green-600', icon: Activity },
          { label: tr('جاهز للخروج', 'Discharge Ready'), value: items.filter(i => i.status === 'DISCHARGE_READY').length, color: 'text-amber-600', icon: ArrowRight },
          { label: tr('تنبيهات مخاطر', 'Risk Alerts'), value: highRisk, color: highRisk > 0 ? 'text-red-600' : 'text-muted-foreground', icon: AlertTriangle },
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

      {/* ── Tabs + Search + Date Preset ── */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        {/* Status tabs */}
        <div className="flex gap-1 bg-muted rounded-lg p-1 self-start">
          {(['active', 'all'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${
                tab === t
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'active' ? tr('نشطة', 'Active') : tr('الكل', 'All')}
            </button>
          ))}
        </div>

        {/* Date preset filter */}
        <div className="flex gap-1 bg-muted rounded-lg p-1 self-start">
          {PRESETS.map(p => (
            <button
              key={p.value}
              onClick={() => setDatePreset(p.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                datePreset === p.value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tr(p.labelAr, p.labelEn)}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full ps-9 pe-3 py-2 text-sm border border-border rounded-lg bg-card focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
            placeholder={tr('بحث بالاسم أو رقم الملف أو الجناح...', 'Search by name, MRN, or ward...')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* ── Empty ── */}
      {!isLoading && items.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          {tr('لا توجد حلقات تنويم', 'No inpatient episodes found')}
        </div>
      )}

      {/* ── Episodes Table ── */}
      {!isLoading && items.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50/50">
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{tr('المريض', 'Patient')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{tr('الحالة', 'Status')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{tr('السرير / الجناح', 'Bed / Ward')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{tr('سبب التنويم', 'Reason')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{tr('تاريخ الدخول', 'Admitted')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{tr('المدة', 'LOS')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{tr('المصدر', 'Source')}</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((ep: any) => {
                  const st = STATUS_CONFIG[ep.status] || STATUS_CONFIG.ACTIVE;
                  const flags = ep.riskFlags || {};
                  const hasRisk = flags.fallRisk || flags.allergyAlert || flags.isolationRequired;
                  const sourceLabel =
                    ep.source?.type === 'ER_ADMISSION_HANDOFF'
                      ? tr('طوارئ', 'ER')
                      : ep.source?.type === 'OPD'
                      ? tr('عيادات خارجية', 'OPD')
                      : tr('مباشر', 'Direct');

                  return (
                    <tr
                      key={ep.id}
                      className="border-b border-border hover:bg-muted/50 cursor-pointer transition"
                      onClick={() => router.push(`/ipd/episode/${ep.id}`)}
                    >
                      {/* Patient */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="font-medium text-foreground">{ep.patientName}</p>
                            {ep.mrn && <p className="text-xs text-muted-foreground font-mono">{ep.mrn}</p>}
                          </div>
                          {hasRisk && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                          {flags.fallRisk && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-orange-100 text-orange-700">
                              {tr('سقوط', 'Fall')}
                            </span>
                          )}
                          {flags.isolationRequired && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-red-100 text-red-700">
                              {tr('عزل', 'Iso')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.color}`}>
                          {isAr ? st.labelAr : st.labelEn}
                        </span>
                      </td>

                      {/* Bed / Ward */}
                      <td className="px-4 py-3">
                        {ep.bedLabel ? (
                          <div className="flex items-center gap-1.5">
                            <Bed className="h-3.5 w-3.5 text-teal-500 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-foreground">{ep.bedLabel}</p>
                              {ep.ward && (
                                <p className="text-xs text-muted-foreground">{ep.ward}</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">{tr('لم يُحدد', 'Unassigned')}</span>
                        )}
                      </td>

                      {/* Reason */}
                      <td className="px-4 py-3 max-w-[180px]">
                        <p className="text-foreground truncate text-sm">
                          {ep.reasonForAdmission || '---'}
                        </p>
                      </td>

                      {/* Admitted date */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-foreground">{fmtDate(ep.createdAt)}</p>
                            <p className="text-xs text-muted-foreground">{fmtTime(ep.createdAt)}</p>
                          </div>
                        </div>
                      </td>

                      {/* LOS */}
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {ep.status === 'ACTIVE' || ep.status === 'DISCHARGE_READY'
                          ? <span className="font-mono text-sm">{timeSince(ep.createdAt)}</span>
                          : '---'}
                      </td>

                      {/* Source */}
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          {sourceLabel}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-end">
                        <ChevronRight className="h-4 w-4 text-muted-foreground inline" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
