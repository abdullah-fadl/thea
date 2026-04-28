'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Download, Loader2 } from 'lucide-react';

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

const REPORTS: Array<{
  key: string;
  ar: string;
  en: string;
  hint: { ar: string; en: string };
}> = [
  {
    key: 'volume-by-category',
    ar: 'حجم الحالات حسب الفئة',
    en: 'Case Volume by Category',
    hint: { ar: 'تجميع حسب categoryKey', en: 'Aggregated by categoryKey' },
  },
  {
    key: 'sla-compliance-trend',
    ar: 'اتجاه الالتزام بالـ SLA',
    en: 'SLA Compliance Trend',
    hint: { ar: 'النسبة اليومية للالتزام', en: 'Daily compliance %' },
  },
  {
    key: 'top-complaint-sources',
    ar: 'أعلى مصادر الشكاوى',
    en: 'Top Complaint Sources',
    hint: { ar: 'حسب القسم', en: 'By department' },
  },
  {
    key: 'resolution-time-distribution',
    ar: 'توزيع زمن الحل',
    en: 'Resolution Time Distribution',
    hint: { ar: 'فئات زمنية', en: 'Time buckets' },
  },
  {
    key: 'satisfaction-over-time',
    ar: 'الرضا عبر الزمن',
    en: 'Satisfaction Over Time',
    hint: { ar: 'متوسط درجة الرضا اليومي', en: 'Daily mean satisfaction' },
  },
];

export default function PxReports() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { isLoading: permLoading, hasPermission } = useRoutePermission('/patient-experience/reports');

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeKey, setActiveKey] = useState(REPORTS[0]!.key);

  const params = useMemo(() => {
    const usp = new URLSearchParams();
    if (dateFrom) usp.set('dateFrom', dateFrom);
    if (dateTo) usp.set('dateTo', dateTo);
    return usp.toString();
  }, [dateFrom, dateTo]);

  const { data, isLoading, error } = useSWR<{
    success: boolean;
    type: string;
    rows: Array<Record<string, string | number | null>>;
  }>(`/api/patient-experience/reports/${activeKey}?${params}`, fetcher, {
    revalidateOnFocus: false,
  });

  if (permLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!hasPermission) return null;

  const rows = data?.rows ?? [];
  const headers = rows.length > 0 ? Object.keys(rows[0]!) : [];

  return (
    <div
      className="container mx-auto p-6 space-y-4"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <div>
        <h1 className="text-2xl font-extrabold">
          {tr('تقارير تجربة المريض', 'Patient Experience Reports')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {tr(
            'تقارير تحليلية مع تصدير CSV',
            'Analytical reports with CSV export',
          )}
        </p>
      </div>

      <Card className="p-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <div>
            <Label className="text-xs">{tr('من تاريخ', 'From date')}</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{tr('إلى تاريخ', 'To date')}</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="md:col-span-2 flex items-end justify-end">
            <a
              href={`/api/patient-experience/reports/${activeKey}/export?${params}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                {tr('تصدير CSV', 'Export CSV')}
              </Button>
            </a>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="p-3 lg:col-span-1">
          <h2 className="text-sm font-bold mb-2">
            {tr('مكتبة التقارير', 'Reports library')}
          </h2>
          <div className="space-y-1">
            {REPORTS.map((r) => (
              <button
                key={r.key}
                onClick={() => setActiveKey(r.key)}
                className={`w-full text-start p-2 rounded-md text-sm transition-colors ${
                  activeKey === r.key
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-muted/50'
                }`}
              >
                <div>{tr(r.ar, r.en)}</div>
                <div className="text-xs text-muted-foreground">
                  {tr(r.hint.ar, r.hint.en)}
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-3 lg:col-span-3">
          <h2 className="text-sm font-bold mb-3">
            {REPORTS.find((r) => r.key === activeKey) &&
              tr(
                REPORTS.find((r) => r.key === activeKey)!.ar,
                REPORTS.find((r) => r.key === activeKey)!.en,
              )}
          </h2>

          {error && (
            <div className="text-sm text-rose-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {tr('فشل تحميل التقرير', 'Failed to load report')}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {tr('لا توجد بيانات', 'No data')}
            </p>
          ) : (
            <>
              <BarChartList rows={rows} headers={headers} />
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      {headers.map((h) => (
                        <th key={h} className="text-start px-3 py-2 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        {headers.map((h) => (
                          <td key={h} className="px-3 py-2 text-xs">
                            {row[h] ?? '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

/**
 * Renders an inline bar chart from the first numeric column of `rows`.
 * Pure CSS — no chart lib dependency.
 */
function BarChartList({
  rows,
  headers,
}: {
  rows: Array<Record<string, string | number | null>>;
  headers: string[];
}) {
  // pick the first column that's numeric in row[0], use the first non-numeric
  // column as the label; fall back to the row index.
  const numericKey =
    headers.find((h) => typeof rows[0]?.[h] === 'number') ?? null;
  const labelKey = headers.find((h) => h !== numericKey) ?? null;
  if (!numericKey) return null;

  const max = rows.reduce(
    (m, r) => Math.max(m, Number(r[numericKey] ?? 0)),
    0,
  ) || 1;

  return (
    <div className="space-y-1.5 mb-2">
      {rows.slice(0, 25).map((r, i) => {
        const value = Number(r[numericKey] ?? 0);
        const pct = Math.round((value / max) * 100);
        const label = labelKey ? String(r[labelKey] ?? '') : `#${i + 1}`;
        return (
          <div key={i}>
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="truncate">{label}</span>
              <span className="text-muted-foreground tabular-nums">{value}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
