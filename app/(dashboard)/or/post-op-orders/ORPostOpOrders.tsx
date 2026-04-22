'use client';

// =============================================================================
// ORPostOpOrders — Post-operative orders overview (today's cases)
// =============================================================================

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import {
  ClipboardList,
  Search,
  RefreshCw,
  User,
  Clock,
  CheckCircle2,
  FileEdit,
  AlertCircle,
  X,
} from 'lucide-react';
import OrPostOpOrdersForm from '@/components/or/OrPostOpOrdersForm';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

// ── Post-op order status per case ─────────────────────────────────────────────

interface CaseWithPostOp {
  id: string;
  patientName: string | null;
  mrn: string | null;
  procedureName: string | null;
  procedureCode: string | null;
  status: string;
  currentStep: string;
  roomName: string | null;
  surgeonName: string | null;
  scheduledStartTime: string | null;
  postOpOrderStatus: 'ACTIVE' | 'DRAFT' | 'NONE';
}

const POST_OP_STATUS_CONFIG: Record<string, { labelAr: string; labelEn: string; color: string; bg: string }> = {
  ACTIVE: { labelAr: 'مفعّل', labelEn: 'Active', color: 'text-green-700 dark:text-green-300', bg: 'bg-green-100 dark:bg-green-900/30' },
  DRAFT:  { labelAr: 'مسودة', labelEn: 'Draft', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  NONE:   { labelAr: 'بدون أوامر', labelEn: 'Pending', color: 'text-muted-foreground', bg: 'bg-muted' },
};

function fmtTime(iso: string | null) {
  if (!iso) return '---';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function ORPostOpOrders() {
  const { language } = useLang();
  const isAr = language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);
  const { toast } = useToast();
  const { hasPermission, isLoading: permLoading } = useRoutePermission('/or/cases');

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'DRAFT' | 'NONE'>('ALL');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  // Fetch today's cases
  const { data: casesData, isLoading: casesLoading, mutate: mutateCases } = useSWR(
    '/api/or/cases/today',
    fetcher,
    { refreshInterval: 15000 },
  );

  const todayCases: any[] = casesData?.items || [];
  const summary = casesData?.summary || { total: 0, inProgress: 0, completed: 0, pending: 0 };

  // Fetch post-op order statuses for all cases (batch lookup via individual SWR)
  // We fetch each case's post-op order only when the case list is ready
  const caseIds = todayCases.map((c: any) => c.id);

  // Bulk-fetch post-op orders for all today's cases
  const { data: postOpBulkData } = useSWR(
    caseIds.length > 0 ? `/api/or/cases/bulk-post-op-status?ids=${caseIds.join(',')}` : null,
    fetcher,
    { refreshInterval: 15000 },
  );

  // Build merged list with post-op status
  const mergedCases: CaseWithPostOp[] = useMemo(() => {
    const statusMap: Record<string, string> = postOpBulkData?.statuses || {};
    return todayCases.map((c: any) => ({
      id: c.id,
      patientName: c.patientName,
      mrn: c.mrn,
      procedureName: c.procedureName,
      procedureCode: c.procedureCode,
      status: c.status,
      currentStep: c.currentStep,
      roomName: c.roomName,
      surgeonName: c.surgeonName,
      scheduledStartTime: c.scheduledStartTime,
      postOpOrderStatus: (statusMap[c.id] || 'NONE') as 'ACTIVE' | 'DRAFT' | 'NONE',
    }));
  }, [todayCases, postOpBulkData]);

  // KPI counts
  const kpis = useMemo(() => {
    const active = mergedCases.filter((c) => c.postOpOrderStatus === 'ACTIVE').length;
    const draft = mergedCases.filter((c) => c.postOpOrderStatus === 'DRAFT').length;
    const none = mergedCases.filter((c) => c.postOpOrderStatus === 'NONE').length;
    return { total: mergedCases.length, active, draft, pending: none };
  }, [mergedCases]);

  // Filtered list
  const displayed = useMemo(() => {
    let list = mergedCases;

    // Status filter
    if (filterStatus !== 'ALL') {
      list = list.filter((c) => c.postOpOrderStatus === filterStatus);
    }

    // Search filter
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((c) =>
        (c.patientName || '').toLowerCase().includes(q) ||
        (c.mrn || '').toLowerCase().includes(q) ||
        (c.procedureName || '').toLowerCase().includes(q) ||
        (c.surgeonName || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [mergedCases, filterStatus, search]);

  // ── Permission guard ──────────────────────────────────────────────────────
  if (permLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <div className="space-y-6 p-4" dir={isAr ? 'rtl' : 'ltr'}>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-indigo-500" />
            {tr('أوامر ما بعد العملية', 'Post-Op Orders')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr('إدارة أوامر ما بعد العملية لحالات اليوم', 'Manage post-operative orders for today\'s cases')}
          </p>
        </div>
        <button
          onClick={() => mutateCases()}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-muted/50 text-muted-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" /> {tr('تحديث', 'Refresh')}
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: tr('إجمالي الحالات', 'Total Cases'), value: kpis.total, color: 'text-indigo-600', icon: ClipboardList },
          { label: tr('أوامر مفعّلة', 'Orders Active'), value: kpis.active, color: 'text-green-600', icon: CheckCircle2 },
          { label: tr('مسودات', 'Drafts'), value: kpis.draft, color: 'text-amber-600', icon: FileEdit },
          { label: tr('بانتظار الأوامر', 'Pending'), value: kpis.pending, color: 'text-muted-foreground', icon: AlertCircle },
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

      {/* ── Tabs + Search ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {([
            { key: 'ALL' as const, ar: 'الكل', en: 'All' },
            { key: 'ACTIVE' as const, ar: 'مفعّل', en: 'Active' },
            { key: 'DRAFT' as const, ar: 'مسودة', en: 'Draft' },
            { key: 'NONE' as const, ar: 'بانتظار', en: 'Pending' },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setFilterStatus(t.key)}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${
                filterStatus === t.key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tr(t.ar, t.en)}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-card focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            placeholder={tr('بحث بالمريض أو العملية أو الجراح...', 'Search by patient, procedure, or surgeon...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Loading ── */}
      {casesLoading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* ── Empty ── */}
      {!casesLoading && displayed.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          {tr('لا توجد حالات اليوم', 'No cases found for today')}
        </div>
      )}

      {/* ── Cases Grid ── */}
      {!casesLoading && displayed.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayed.map((c) => {
            const postOpCfg = POST_OP_STATUS_CONFIG[c.postOpOrderStatus] || POST_OP_STATUS_CONFIG.NONE;

            return (
              <div
                key={c.id}
                onClick={() => setSelectedCaseId(c.id)}
                className="bg-card rounded-xl border border-border p-4 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 cursor-pointer transition-all space-y-3"
              >
                {/* Patient info */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium text-foreground text-sm">{c.patientName || '---'}</p>
                      {c.mrn && <p className="text-[10px] text-muted-foreground font-mono">{c.mrn}</p>}
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${postOpCfg.bg} ${postOpCfg.color}`}>
                    {tr(postOpCfg.labelAr, postOpCfg.labelEn)}
                  </span>
                </div>

                {/* Procedure */}
                <div>
                  <p className="text-xs text-muted-foreground">{tr('العملية', 'Procedure')}</p>
                  <p className="text-sm text-foreground truncate">{c.procedureName || '---'}</p>
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {c.scheduledStartTime && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {fmtTime(c.scheduledStartTime)}
                    </span>
                  )}
                  {c.roomName && (
                    <span>{c.roomName}</span>
                  )}
                  {c.surgeonName && (
                    <span className="truncate max-w-[120px]">{c.surgeonName}</span>
                  )}
                </div>

                {/* Case phase */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {tr('المرحلة', 'Phase')}: <span className="font-semibold text-muted-foreground">{c.currentStep}</span>
                  </span>
                  <span className="text-[10px] text-indigo-500 font-medium">
                    {tr('فتح الأوامر', 'Open Orders')} &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Dialog / Slide-over for Post-Op Orders Form ── */}
      {selectedCaseId && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSelectedCaseId(null)}
          />
          {/* Panel */}
          <div className={`relative ${isAr ? 'mr-auto' : 'ml-auto'} w-full max-w-3xl h-full bg-background overflow-y-auto shadow-2xl`}>
            {/* Panel header */}
            <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {tr('أوامر ما بعد العملية', 'Post-Op Orders')}
                </h2>
                <p className="text-xs text-muted-foreground font-mono">
                  {tr('رقم الحالة', 'Case')}: {selectedCaseId.slice(0, 8)}
                </p>
              </div>
              <button
                onClick={() => setSelectedCaseId(null)}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Form */}
            <div className="p-6">
              <OrPostOpOrdersForm
                caseId={selectedCaseId}
                onSaved={() => {
                  mutateCases();
                  toast({ title: tr('تم الحفظ', 'Saved') });
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
