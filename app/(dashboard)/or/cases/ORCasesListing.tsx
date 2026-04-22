'use client';

// =============================================================================
// ORCasesListing — Operating Room cases overview
// =============================================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import {
  Scissors,
  Search,
  RefreshCw,
  ChevronRight,
  User,
  Calendar,
  Clock,
  Activity,
  CheckCircle2,
  XCircle,
  PlayCircle,
  AlertCircle,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { labelEn: string; labelAr: string; color: string; bg: string; icon: any }> = {
  OPEN:        { labelEn: 'Scheduled',   labelAr: 'مجدولة',    color: 'text-blue-700 dark:text-blue-300',   bg: 'bg-blue-100 dark:bg-blue-900/30',   icon: Clock },
  IN_PROGRESS: { labelEn: 'In Progress', labelAr: 'جارية',     color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-900/30', icon: PlayCircle },
  COMPLETED:   { labelEn: 'Completed',   labelAr: 'مكتملة',    color: 'text-green-700 dark:text-green-300', bg: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircle2 },
  CANCELLED:   { labelEn: 'Cancelled',   labelAr: 'ملغاة',     color: 'text-red-700 dark:text-red-300',     bg: 'bg-red-100 dark:bg-red-900/30',     icon: XCircle },
};

const STEP_LABELS: Record<string, { en: string; ar: string; color: string }> = {
  START:    { en: 'Awaiting',   ar: 'بانتظار',      color: 'text-muted-foreground' },
  PRE_OP:   { en: 'Pre-Op',     ar: 'ما قبل',       color: 'text-blue-600' },
  TIME_OUT: { en: 'Time-Out',   ar: 'وقت مستقطع',   color: 'text-amber-600' },
  INTRA_OP: { en: 'Surgery',    ar: 'أثناء العملية', color: 'text-red-600' },
  POST_OP:  { en: 'Post-Op',    ar: 'ما بعد',       color: 'text-purple-600' },
  RECOVERY: { en: 'Recovery',   ar: 'إفاقة',        color: 'text-green-600' },
};

function fmtDate(iso: string | null) {
  if (!iso) return '---';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// ── Phase progress bar ───────────────────────────────────────────────────────
const PHASES = ['PRE_OP', 'TIME_OUT', 'INTRA_OP', 'POST_OP', 'RECOVERY'];

function PhaseBar({ currentStep }: { currentStep: string }) {
  const idx = PHASES.indexOf(currentStep);
  return (
    <div className="flex items-center gap-0.5">
      {PHASES.map((phase, i) => (
        <div
          key={phase}
          className={`h-1.5 w-5 rounded-full ${
            i <= idx
              ? i === idx
                ? 'bg-indigo-500'
                : 'bg-green-400'
              : 'bg-muted'
          }`}
          title={phase}
        />
      ))}
    </div>
  );
}

export default function ORCasesListing() {
  const { language } = useLang();
  const isAr = language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);
  const router = useRouter();

  const [tab, setTab] = useState<'active' | 'completed' | 'all'>('active');
  const [search, setSearch] = useState('');

  const statusParam = tab === 'active' ? '' : tab === 'completed' ? '&status=COMPLETED' : '&status=ALL';
  const searchQ = search.trim() ? `&q=${encodeURIComponent(search.trim())}` : '';
  const url = `/api/or/cases?limit=200${statusParam}${searchQ}`;

  const { data, isLoading, mutate } = useSWR(url, fetcher, { refreshInterval: 15000 });

  const items: any[] = data?.items || [];
  const summary = data?.summary || { total: 0, open: 0, inProgress: 0, completed: 0, cancelled: 0 };

  // For the "active" tab: show OPEN + IN_PROGRESS
  const displayed = tab === 'active'
    ? items.filter(i => i.status === 'OPEN' || i.status === 'IN_PROGRESS')
    : items;

  return (
    <div className="space-y-6 p-4">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Scissors className="h-6 w-6 text-red-500" />
            {tr('غرفة العمليات', 'Operating Room')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr('إدارة ومتابعة جميع العمليات الجراحية', 'Manage and track all surgical cases')}
          </p>
        </div>
        <button onClick={() => mutate()} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-muted/50 text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5" /> {tr('تحديث', 'Refresh')}
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: tr('مجدولة', 'Scheduled'), value: summary.open, color: 'text-blue-600', icon: Clock },
          { label: tr('جارية الآن', 'In Progress'), value: summary.inProgress, color: 'text-amber-600', icon: PlayCircle },
          { label: tr('مكتملة', 'Completed'), value: summary.completed, color: 'text-green-600', icon: CheckCircle2 },
          { label: tr('ملغاة', 'Cancelled'), value: summary.cancelled, color: 'text-red-600', icon: XCircle },
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
          {(['active', 'completed', 'all'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${
                tab === t
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'active' ? tr('نشطة', 'Active') : t === 'completed' ? tr('مكتملة', 'Completed') : tr('الكل', 'All')}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-card focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
            placeholder={tr('بحث بالمريض أو العملية...', 'Search by patient or procedure...')}
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
      {!isLoading && displayed.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          {tr('لا توجد عمليات', 'No surgical cases found')}
        </div>
      )}

      {/* ── Cases Table ── */}
      {!isLoading && displayed.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50/50">
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{tr('المريض', 'Patient')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{tr('العملية', 'Procedure')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{tr('الحالة', 'Status')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{tr('المرحلة', 'Phase')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{tr('التقدم', 'Progress')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{tr('التاريخ', 'Date')}</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((c: any) => {
                  const st = STATUS_CONFIG[c.status] || STATUS_CONFIG.OPEN;
                  const StIcon = st.icon;
                  const step = STEP_LABELS[c.currentStep] || STEP_LABELS.START;

                  return (
                    <tr
                      key={c.id}
                      className="border-b border-border hover:bg-muted/50 cursor-pointer transition"
                      onClick={() => router.push(`/or/cases/${c.id}`)}
                    >
                      {/* Patient */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="font-medium text-foreground">{c.patientName}</p>
                            {c.mrn && <p className="text-xs text-muted-foreground font-mono">{c.mrn}</p>}
                          </div>
                        </div>
                      </td>

                      {/* Procedure */}
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-foreground truncate">{c.procedureName || '---'}</p>
                        {c.procedureCode && <p className="text-[10px] text-muted-foreground font-mono">{c.procedureCode}</p>}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.color}`}>
                          <StIcon className="h-3 w-3" />
                          {isAr ? st.labelAr : st.labelEn}
                        </span>
                      </td>

                      {/* Current Phase */}
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold ${step.color}`}>
                          {isAr ? step.ar : step.en}
                        </span>
                      </td>

                      {/* Progress */}
                      <td className="px-4 py-3">
                        <PhaseBar currentStep={c.currentStep} />
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-foreground">{fmtDate(c.createdAt)}</span>
                          <span className="text-muted-foreground text-xs">{fmtTime(c.createdAt)}</span>
                        </div>
                      </td>

                      {/* Arrow */}
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
