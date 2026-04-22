'use client';

// =============================================================================
// AuditTrail — IPD audit log viewer
// =============================================================================

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import {
  Shield,
  Search,
  RefreshCw,
  Clock,
  User,
  ChevronDown,
  ChevronRight,
  FileText,
  Activity,
  Download,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

// ── Action colors ─────────────────────────────────────────────────────────────
const ACTION_COLORS: Record<string, { color: string; bg: string }> = {
  CREATE:        { color: 'text-green-700 dark:text-green-300',  bg: 'bg-green-100 dark:bg-green-900/30' },
  UPDATE:        { color: 'text-blue-700 dark:text-blue-300',    bg: 'bg-blue-100 dark:bg-blue-900/30' },
  SET_STATUS:    { color: 'text-amber-700 dark:text-amber-300',  bg: 'bg-amber-100 dark:bg-amber-900/30' },
  SET_LOCATION:  { color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  SET_OWNERSHIP: { color: 'text-cyan-700 dark:text-cyan-300',    bg: 'bg-cyan-100 dark:bg-cyan-900/30' },
  DELETE:        { color: 'text-red-700 dark:text-red-300',      bg: 'bg-red-100 dark:bg-red-900/30' },
  CANCEL:        { color: 'text-red-700 dark:text-red-300',      bg: 'bg-red-100 dark:bg-red-900/30' },
  DISCHARGE:     { color: 'text-teal-700 dark:text-teal-300',    bg: 'bg-teal-100 dark:bg-teal-900/30' },
  ADMIT:         { color: 'text-indigo-700 dark:text-indigo-300', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
};

const RESOURCE_LABELS: Record<string, { en: string; ar: string }> = {
  ipd_episode:          { en: 'Episode',         ar: 'حلقة تنويم' },
  ipd_order:            { en: 'Order',           ar: 'طلب' },
  ipd_admission:        { en: 'Admission',       ar: 'قبول' },
  ipd_vitals:           { en: 'Vitals',          ar: 'علامات حيوية' },
  ipd_admission_intake: { en: 'Intake',          ar: 'استقبال' },
};

const ALL_ACTIONS = ['CREATE', 'UPDATE', 'SET_STATUS', 'SET_LOCATION', 'SET_OWNERSHIP', 'DELETE', 'CANCEL', 'DISCHARGE', 'ADMIT'];

function fmtDateTime(iso: string | null) {
  if (!iso) return '---';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function downloadCsv(items: any[]) {
  const headers = ['Timestamp', 'Action', 'Resource Type', 'Resource ID', 'Actor', 'IP'];
  const rows = items.map(it => [
    fmtDateTime(it.timestamp),
    it.action,
    it.resourceType,
    it.resourceId,
    it.actorDisplay,
    it.ip || '',
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ipd-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditTrail() {
  const { language } = useLang();
  const isAr = language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(0);
  const limit = 50;

  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(page * limit));
  if (typeFilter) params.set('type', typeFilter);
  if (search.trim()) params.set('q', search.trim());
  if (dateFrom) params.set('from', dateFrom);
  if (dateTo) params.set('to', dateTo);

  const { data, isLoading, mutate } = useSWR(
    `/api/ipd/audit?${params}`,
    fetcher,
    { refreshInterval: 60000 }
  );

  let items: any[] = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  // Client-side action filter (server doesn't support action filtering yet)
  if (actionFilter) {
    items = items.filter(it => it.action === actionFilter);
  }

  const toggleExpand = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const resetFilters = () => {
    setSearch('');
    setTypeFilter('');
    setActionFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(0);
  };

  const hasActiveFilters = search || typeFilter || actionFilter || dateFrom || dateTo;

  return (
    <div className="space-y-6 p-4" dir={isAr ? 'rtl' : 'ltr'}>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-violet-500" />
            {tr('سجل تدقيق التنويم', 'IPD Audit Trail')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr('كل العمليات على حلقات ومرضى التنويم', 'All operations on inpatient episodes and patients')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => items.length > 0 && downloadCsv(items)}
            disabled={items.length === 0}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-muted/50 text-muted-foreground disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" /> {tr('تصدير CSV', 'Export CSV')}
          </button>
          <button
            onClick={() => mutate()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-muted/50 text-muted-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" /> {tr('تحديث', 'Refresh')}
          </button>
        </div>
      </div>

      {/* ── KPI ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: tr('إجمالي السجلات', 'Total Records'),    value: total,   color: 'text-violet-600', icon: FileText },
          { label: tr('في هذه الصفحة', 'On This Page'),      value: items.length, color: 'text-blue-600', icon: Activity },
          { label: tr('مستخدمين فريدين', 'Unique Users'),    value: new Set(items.map(i => i.actorUserId)).size, color: 'text-green-600', icon: User },
          { label: tr('الإنشاء', 'Creates'),                 value: items.filter(i => i.action === 'CREATE').length, color: 'text-teal-600', icon: Clock },
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
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              className="w-full ps-9 pe-3 py-2 text-sm border border-border rounded-lg bg-card focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
              placeholder={tr('بحث بالمستخدم أو المعرف أو العملية...', 'Search by user, ID, or action...')}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
            />
          </div>

          {/* Resource type */}
          <select
            className="px-3 py-2 text-sm border border-border rounded-lg bg-card outline-none focus:ring-2 focus:ring-violet-500"
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setPage(0); }}
          >
            <option value="">{tr('كل الأنواع', 'All Resource Types')}</option>
            {Object.entries(RESOURCE_LABELS).map(([key, lbl]) => (
              <option key={key} value={key}>{isAr ? lbl.ar : lbl.en}</option>
            ))}
          </select>

          {/* Action type */}
          <select
            className="px-3 py-2 text-sm border border-border rounded-lg bg-card outline-none focus:ring-2 focus:ring-violet-500"
            value={actionFilter}
            onChange={e => { setActionFilter(e.target.value); setPage(0); }}
          >
            <option value="">{tr('كل العمليات', 'All Actions')}</option>
            {ALL_ACTIONS.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        {/* Date range */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <span className="text-xs text-muted-foreground shrink-0">{tr('الفترة:', 'Date range:')}</span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(0); }}
              className="px-3 py-1.5 text-sm border border-border rounded-lg bg-card outline-none focus:ring-2 focus:ring-violet-500"
            />
            <span className="text-muted-foreground">→</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              onChange={e => { setDateTo(e.target.value); setPage(0); }}
              className="px-3 py-1.5 text-sm border border-border rounded-lg bg-card outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs text-violet-600 hover:text-violet-800 underline"
            >
              {tr('إعادة ضبط الفلاتر', 'Reset filters')}
            </button>
          )}
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
          {tr('لا توجد سجلات تدقيق تطابق الفلاتر المحددة', 'No audit records match the selected filters')}
        </div>
      )}

      {/* ── Timeline ── */}
      {!isLoading && items.length > 0 && (
        <div className="space-y-2">
          {items.map((log: any) => {
            const ac = ACTION_COLORS[log.action] || { color: 'text-muted-foreground', bg: 'bg-muted' };
            const rl = RESOURCE_LABELS[log.resourceType] || { en: log.resourceType, ar: log.resourceType };
            const isExp = expanded[log.id];
            const meta = log.metadata || {};
            const hasMeta = Object.keys(meta).length > 0;

            return (
              <div key={log.id} className="bg-card rounded-xl border border-border overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition"
                  onClick={() => hasMeta && toggleExpand(log.id)}
                >
                  {/* Timestamp */}
                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground w-44 shrink-0">
                    <Clock className="h-3.5 w-3.5" />
                    {fmtDateTime(log.timestamp)}
                  </div>

                  {/* Action badge */}
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${ac.bg} ${ac.color} w-28 justify-center shrink-0`}>
                    {log.action}
                  </span>

                  {/* Resource */}
                  <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                    {isAr ? rl.ar : rl.en}
                  </span>

                  {/* Resource ID */}
                  <span className="text-xs font-mono text-muted-foreground truncate flex-1">
                    {log.resourceId ? log.resourceId.slice(0, 14) + '…' : '---'}
                  </span>

                  {/* Actor */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="max-w-[120px] truncate">{log.actorDisplay}</span>
                  </div>

                  {/* IP */}
                  {log.ip && (
                    <span className="hidden lg:inline text-[10px] font-mono text-muted-foreground">{log.ip}</span>
                  )}

                  {/* Expand indicator */}
                  {hasMeta && (
                    isExp
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </div>

                {/* Expanded metadata */}
                {isExp && hasMeta && (
                  <div className="px-4 pb-3 border-t border-border">
                    <pre className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 overflow-x-auto max-h-48">
                      {JSON.stringify(meta, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            {tr('صفحة', 'Page')} {page + 1} / {totalPages} — {total} {tr('سجل', 'records')}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-xs border rounded-lg disabled:opacity-40 hover:bg-muted/50 transition"
            >
              {tr('السابقة', 'Previous')}
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-xs border rounded-lg disabled:opacity-40 hover:bg-muted/50 transition"
            >
              {tr('التالية', 'Next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
