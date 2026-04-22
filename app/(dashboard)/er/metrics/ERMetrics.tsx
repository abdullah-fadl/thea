'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';

type MetricStats = {
  count: number;
  avgMin: number | null;
  p50Min: number | null;
  p90Min: number | null;
  slaTargetMin: number | null;
  slaBreachPct: number | null;
};

type ApiResult = {
  range: { from: string; to: string };
  totalEncounters: number;
  metrics: Record<string, MetricStats>;
};

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

function formatMinutes(min: number | null): string {
  if (min == null) return '—';
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return `${h}h ${m}m`;
  }
  return `${min}m`;
}

function toDateTimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ERMetrics() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { hasPermission, isLoading } = useRoutePermission('/er/metrics');

  const now = useMemo(() => new Date(), []);
  const [fromLocal, setFromLocal] = useState(() => toDateTimeLocalValue(new Date(now.getTime() - 24 * 60 * 60 * 1000)));
  const [toLocal, setToLocal] = useState(() => toDateTimeLocalValue(now));
  const [applied, setApplied] = useState<{ fromIso: string; toIso: string }>(() => ({
    fromIso: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    toIso: now.toISOString(),
  }));

  const url = useMemo(() => {
    const qs = new URLSearchParams({ from: applied.fromIso, to: applied.toIso });
    return `/api/er/metrics?${qs.toString()}`;
  }, [applied.fromIso, applied.toIso]);

  const { data, isLoading: loading, mutate } = useSWR<ApiResult>(hasPermission ? url : null, fetcher, {
    refreshInterval: 0,
  });

  const cards = useMemo(() => {
    const m: Record<string, MetricStats | undefined> = data?.metrics || {};
    return [
      { key: 'doorToTriage', title: tr('الباب ← الفرز', 'Door → Triage'), subtitle: 'createdAt → triageEndAt' },
      { key: 'triageToBed', title: tr('الفرز ← السرير', 'Triage → Bed'), subtitle: 'triageEndAt → first bed assignedAt' },
      { key: 'bedToSeen', title: tr('السرير ← المعاينة', 'Bed → Seen by Doctor'), subtitle: 'bedAssignedAt → seenByDoctorAt' },
      { key: 'seenToOrders', title: tr('المعاينة ← الطلبات', 'Seen → Orders Started'), subtitle: 'seenByDoctorAt → ordersStartedAt' },
      { key: 'ordersToResultsPending', title: tr('الطلبات ← انتظار النتائج', 'Orders → Results Pending'), subtitle: 'ordersStartedAt → resultsPendingAt' },
      { key: 'resultsPendingToDecision', title: tr('انتظار النتائج ← القرار', 'Results Pending → Decision'), subtitle: 'resultsPendingAt → decisionAt' },
      { key: 'erLosAdmit', title: tr('مدة الإقامة (تنويم)', 'ER LOS (Admit)'), subtitle: 'createdAt → closedAt (admitted only)' },
    ].map((c) => ({ ...c, stats: m[c.key] }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, language]);

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tr('مقاييس الطوارئ و SLA', 'ER Metrics & SLA')}</h1>
          <p className="text-sm text-muted-foreground">{tr('مقاييس تشغيلية للقراءة فقط مستمدة من الطوابع الزمنية.', 'Read-only operational metrics derived from existing ER timestamps.')}</p>
        </div>

        {/* Date Range */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="text-base font-bold text-foreground">{tr('النطاق الزمني', 'Date Range')}</h2>
          </div>
          <div className="p-5 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('من', 'From')}</label>
              <input
                type="datetime-local"
                value={fromLocal}
                onChange={(e) => setFromLocal(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border-[1.5px] border-border bg-background text-foreground text-sm thea-input-focus"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('إلى', 'To')}</label>
              <input
                type="datetime-local"
                value={toLocal}
                onChange={(e) => setToLocal(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border-[1.5px] border-border bg-background text-foreground text-sm thea-input-focus"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const from = new Date(fromLocal);
                  const to = new Date(toLocal);
                  setApplied({ fromIso: from.toISOString(), toIso: to.toISOString() });
                }}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 thea-transition-fast"
              >
                {tr('تطبيق', 'Apply')}
              </button>
              <button
                type="button"
                onClick={() => mutate()}
                className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-muted thea-transition-fast"
              >
                {tr('تحديث', 'Refresh')}
              </button>
            </div>
            <div className="text-xs text-muted-foreground">
              {loading ? tr('جاري التحميل…', 'Loading…') : data ? `${data.totalEncounters} ${tr('زيارة في النطاق', 'visits in range')}` : '—'}
            </div>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((c) => (
            <div key={c.key} className="rounded-2xl bg-card border border-border overflow-hidden">
              <div className="p-5 border-b border-border">
                <h3 className="text-base font-bold text-foreground">{c.title}</h3>
                <p className="text-xs text-muted-foreground">{c.subtitle}</p>
              </div>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">{tr('المتوسط', 'Avg')}</div>
                  <div className="font-medium text-foreground">{formatMinutes(c.stats?.avgMin ?? null)}</div>
                  <div className="text-muted-foreground">{tr('الوسيط', 'p50')}</div>
                  <div className="font-medium text-foreground">{formatMinutes(c.stats?.p50Min ?? null)}</div>
                  <div className="text-muted-foreground">{tr('المئين 90', 'p90')}</div>
                  <div className="font-medium text-foreground">{formatMinutes(c.stats?.p90Min ?? null)}</div>
                  <div className="text-muted-foreground">{tr('العدد', 'Count')}</div>
                  <div className="font-medium text-foreground">{c.stats?.count ?? 0}</div>
                </div>

                <div className="text-xs text-muted-foreground">
                  {tr('هدف SLA:', 'SLA target:')}{' '}
                  <span className="text-foreground">
                    {c.stats?.slaTargetMin != null ? formatMinutes(c.stats.slaTargetMin) : '—'}
                  </span>
                  {' • '}
                  {tr('التجاوز:', 'Breach:')}{' '}
                  <span className="text-foreground">
                    {c.stats?.slaBreachPct != null ? `${c.stats.slaBreachPct}%` : '—'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
