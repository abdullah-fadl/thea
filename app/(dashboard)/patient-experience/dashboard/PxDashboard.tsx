'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Heart,
  Loader2,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

const WINDOWS: Array<{ value: string; ar: string; en: string }> = [
  { value: '7', ar: 'آخر 7 أيام', en: 'Last 7 days' },
  { value: '30', ar: 'آخر 30 يومًا', en: 'Last 30 days' },
  { value: '90', ar: 'آخر 90 يومًا', en: 'Last 90 days' },
  { value: '365', ar: 'آخر سنة', en: 'Last 365 days' },
];

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-50 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CLOSED: 'bg-slate-100 text-slate-700 border-slate-300',
  ESCALATED: 'bg-rose-50 text-rose-700 border-rose-200',
};

const SEVERITY_COLORS: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-700',
  MEDIUM: 'bg-blue-50 text-blue-700',
  HIGH: 'bg-amber-50 text-amber-700',
  CRITICAL: 'bg-rose-50 text-rose-700',
};

interface Kpis {
  totalOpen: number;
  totalInProgress: number;
  totalResolved: number;
  totalClosed: number;
  totalEscalated: number;
  total: number;
  avgResolutionMinutes: number | null;
  slaCompliancePct: number | null;
  satisfactionScore: number | null;
  satisfactionCount: number;
  pendingEscalations: number;
  trendingCategories: Array<{ category: string; count: number }>;
}

interface RecentCase {
  id: string;
  caseNumber: number;
  status: string;
  severity: string | null;
  categoryKey: string | null;
  subjectName: string | null;
  createdAt: string;
  dueAt: string | null;
  escalationLevel: number;
}

function formatMinutes(mins: number | null, language: 'ar' | 'en'): string {
  if (mins == null) return '—';
  if (mins < 60) return language === 'ar' ? `${mins} د` : `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return language === 'ar' ? `${h}س ${m}د` : `${h}h ${m}m`;
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return language === 'ar' ? `${d}ي ${remH}س` : `${d}d ${remH}h`;
}

function formatDate(iso: string, language: 'ar' | 'en'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : 'en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export default function PxDashboard() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { isLoading: permLoading, hasPermission } = useRoutePermission('/patient-experience/dashboard');

  const [windowDays, setWindowDays] = useState('30');
  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    kpis: Kpis;
    recent: RecentCase[];
  }>(`/api/patient-experience/kpis?days=${windowDays}`, fetcher, {
    revalidateOnFocus: false,
  });

  const kpis = data?.kpis;
  const recent = useMemo(() => data?.recent ?? [], [data?.recent]);

  if (permLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!hasPermission) return null;

  return (
    <div
      className="container mx-auto p-6 space-y-6"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Heart className="h-6 w-6 text-rose-500" />
            <h1 className="text-2xl font-extrabold">
              {tr('لوحة تجربة المريض', 'Patient Experience Dashboard')}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {tr(
              'مؤشرات الأداء، الحالات الحديثة، والتصعيدات المعلقة',
              'KPIs, recent cases, and pending escalations',
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={windowDays} onValueChange={setWindowDays}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOWS.map((w) => (
                <SelectItem key={w.value} value={w.value}>
                  {tr(w.ar, w.en)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => mutate()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            {tr('تحديث', 'Refresh')}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="p-4 border-rose-200 bg-rose-50 text-rose-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">
              {tr('فشل تحميل البيانات', 'Failed to load data')} —{' '}
              {String((error as Error).message ?? error)}
            </span>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiTile
          label={tr('الحالات المفتوحة', 'Open Cases')}
          value={kpis ? kpis.totalOpen + kpis.totalInProgress : '—'}
          tone="blue"
          icon={<Clock className="h-4 w-4" />}
          loading={isLoading}
        />
        <KpiTile
          label={tr('متوسط زمن الحل', 'Avg Resolution')}
          value={kpis ? formatMinutes(kpis.avgResolutionMinutes, language) : '—'}
          tone="slate"
          icon={<TrendingUp className="h-4 w-4" />}
          loading={isLoading}
        />
        <KpiTile
          label={tr('الالتزام بالـ SLA', 'SLA Compliance')}
          value={
            kpis?.slaCompliancePct == null
              ? tr('لا توجد بيانات', 'No data')
              : `${kpis.slaCompliancePct}%`
          }
          tone={
            kpis?.slaCompliancePct != null && kpis.slaCompliancePct < 80
              ? 'rose'
              : 'emerald'
          }
          icon={<CheckCircle2 className="h-4 w-4" />}
          loading={isLoading}
        />
        <KpiTile
          label={tr('درجة الرضا', 'Satisfaction')}
          value={
            kpis?.satisfactionScore == null
              ? tr('لا توجد بيانات', 'No data')
              : `${kpis.satisfactionScore} / 5 (${kpis.satisfactionCount})`
          }
          tone="amber"
          icon={<Heart className="h-4 w-4" />}
          loading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-extrabold">
              {tr('أحدث الحالات', 'Recent Cases')}
            </h2>
            <Link href="/patient-experience/cases">
              <Button variant="ghost" size="sm" className="gap-1">
                {tr('عرض الكل', 'View all')}
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : recent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {tr('لا توجد حالات بعد', 'No cases yet')}
            </p>
          ) : (
            <div className="space-y-2">
              {recent.map((c) => (
                <Link
                  key={c.id}
                  href={`/patient-experience/cases?case=${c.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between gap-3 p-3 rounded-md border border-border hover:bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">
                          #{c.caseNumber}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[c.status] ?? ''}`}
                        >
                          {c.status}
                        </span>
                        {c.severity && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${SEVERITY_COLORS[c.severity] ?? ''}`}
                          >
                            {c.severity}
                          </span>
                        )}
                        {c.escalationLevel > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded bg-rose-50 text-rose-700">
                            ↑ L{c.escalationLevel}
                          </span>
                        )}
                      </div>
                      <p className="text-sm mt-1 truncate">
                        {c.subjectName ?? tr('مجهول', 'Anonymous')}
                        {c.categoryKey ? ` · ${c.categoryKey}` : ''}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(c.createdAt, language)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="text-base font-extrabold mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-500" />
              {tr('التصعيدات المعلقة', 'Pending Escalations')}
            </h2>
            <div className="text-3xl font-bold">
              {isLoading ? '…' : (kpis?.pendingEscalations ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {tr(
                'حالات مفتوحة تجاوزت موعد الـ SLA',
                'Open cases past their SLA window',
              )}
            </p>
          </Card>

          <Card className="p-4">
            <h2 className="text-base font-extrabold mb-3">
              {tr('الفئات الأكثر تكرارًا', 'Trending Categories')}
            </h2>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : !kpis || kpis.trendingCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {tr('لا توجد بيانات', 'No data')}
              </p>
            ) : (
              <div className="space-y-2">
                {kpis.trendingCategories.map((c) => {
                  const max = kpis.trendingCategories[0]!.count || 1;
                  const pct = Math.round((c.count / max) * 100);
                  return (
                    <div key={c.category}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium">{c.category}</span>
                        <span className="text-muted-foreground">{c.count}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  tone,
  icon,
  loading,
}: {
  label: string;
  value: number | string;
  tone: 'blue' | 'slate' | 'emerald' | 'amber' | 'rose';
  icon: React.ReactNode;
  loading?: boolean;
}) {
  const toneClass = {
    blue: 'text-blue-700 bg-blue-50 border-blue-100',
    slate: 'text-slate-700 bg-slate-50 border-slate-200',
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    amber: 'text-amber-700 bg-amber-50 border-amber-100',
    rose: 'text-rose-700 bg-rose-50 border-rose-100',
  }[tone];
  return (
    <Card className={`p-4 border ${toneClass}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-80">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : value}
      </div>
    </Card>
  );
}
