'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';

interface KpiSnapshot {
  id: string;
  kpiCode: string;
  periodType: string;
  periodStart: string;
  numericValue: number;
  previousValue: number | null;
  percentChange: number | null;
  targetValue: number | null;
  dataPoints: number;
  calculatedAt: string;
}

const KPI_CODE_OPTIONS = [
  'STOCKOUT_RATE', 'EXPIRING_ITEMS', 'ORDER_FILL_RATE', 'PROCUREMENT_SPEND',
  'MAINTENANCE_COMPLIANCE', 'ACTIVE_ALERTS', 'INVENTORY_TURNOVER',
] as const;

const PERIOD_TYPE_OPTIONS = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'] as const;

export default function AnalyticsKpiPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [data, setData] = useState<KpiSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [kpiCodeFilter, setKpiCodeFilter] = useState('');
  const [periodTypeFilter, setPeriodTypeFilter] = useState('');
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (kpiCodeFilter) params.set('kpiCode', kpiCodeFilter);
      if (periodTypeFilter) params.set('periodType', periodTypeFilter);
      const res = await fetch(`/api/imdad/analytics/kpi-snapshots?${params}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setData(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 0);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [page, search, kpiCodeFilter, periodTypeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const kpiCodeBadge = (code: string) => {
    const map: Record<string, { color: string; label: string }> = {
      STOCKOUT_RATE: { color: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#A0522D]', label: tr('معدل النفاد', 'Stockout Rate') },
      EXPIRING_ITEMS: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', label: tr('أصناف منتهية', 'Expiring Items') },
      ORDER_FILL_RATE: { color: 'bg-[#6B8E23]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]', label: tr('معدل تعبئة الطلبات', 'Order Fill Rate') },
      PROCUREMENT_SPEND: { color: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#C4960C]/20 dark:text-[#E8A317]', label: tr('إنفاق المشتريات', 'Procurement Spend') },
      MAINTENANCE_COMPLIANCE: { color: 'bg-[#556B2F]/10 text-[#556B2F] dark:bg-[#4A5D23]/20 dark:text-[#9CB86B]', label: tr('امتثال الصيانة', 'Maintenance Compliance') },
      ACTIVE_ALERTS: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', label: tr('تنبيهات نشطة', 'Active Alerts') },
      INVENTORY_TURNOVER: { color: 'bg-[#6B8E23]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]', label: tr('دوران المخزون', 'Inventory Turnover') },
    };
    const s = map[code] || { color: 'bg-gray-100 text-gray-800', label: code };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  const kpiCodeFilterLabel = (code: string) => {
    const map: Record<string, string> = {
      STOCKOUT_RATE: tr('معدل النفاد', 'Stockout Rate'),
      EXPIRING_ITEMS: tr('أصناف منتهية', 'Expiring Items'),
      ORDER_FILL_RATE: tr('معدل تعبئة الطلبات', 'Order Fill Rate'),
      PROCUREMENT_SPEND: tr('إنفاق المشتريات', 'Procurement Spend'),
      MAINTENANCE_COMPLIANCE: tr('امتثال الصيانة', 'Maintenance Compliance'),
      ACTIVE_ALERTS: tr('تنبيهات نشطة', 'Active Alerts'),
      INVENTORY_TURNOVER: tr('دوران المخزون', 'Inventory Turnover'),
    };
    return map[code] || code;
  };

  const periodTypeLabel = (p: string) => {
    const map: Record<string, string> = {
      DAILY: tr('يومي', 'Daily'),
      WEEKLY: tr('أسبوعي', 'Weekly'),
      MONTHLY: tr('شهري', 'Monthly'),
      QUARTERLY: tr('ربع سنوي', 'Quarterly'),
      ANNUAL: tr('سنوي', 'Annual'),
    };
    return map[p] || p;
  };

  const percentChangeBadge = (pct: number | null) => {
    if (pct === null || pct === undefined) return <span className="text-gray-400">—</span>;
    const isPositive = pct >= 0;
    const color = isPositive
      ? 'text-[#6B8E23] dark:text-[#9CB86B]'
      : 'text-[#8B4513] dark:text-[#A0522D]';
    const arrow = isPositive ? '\u2191' : '\u2193';
    return (
      <span className={`font-medium ${color}`}>
        {arrow} {Math.abs(pct).toFixed(1)}%
      </span>
    );
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US');
  };

  const formatNumber = (n: number | null) => {
    if (n === null || n === undefined) return '—';
    return n.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US');
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4 md:space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {tr('لقطات مؤشرات الأداء', 'KPI Snapshots')}
      </h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder={tr('بحث...', 'Search...')}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        />
        <select
          value={kpiCodeFilter}
          onChange={e => { setKpiCodeFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">{tr('جميع المؤشرات', 'All KPIs')}</option>
          {KPI_CODE_OPTIONS.map(k => (
            <option key={k} value={k}>{kpiCodeFilterLabel(k)}</option>
          ))}
        </select>
        <select
          value={periodTypeFilter}
          onChange={e => { setPeriodTypeFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">{tr('جميع الفترات', 'All Periods')}</option>
          {PERIOD_TYPE_OPTIONS.map(p => (
            <option key={p} value={p}>{periodTypeLabel(p)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {tr('جارٍ التحميل...', 'Loading...')}
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {tr('لا توجد لقطات مؤشرات أداء', 'No KPI snapshots found')}
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {[
                  tr('رمز المؤشر', 'KPI Code'),
                  tr('نوع الفترة', 'Period Type'),
                  tr('بداية الفترة', 'Period Start'),
                  tr('القيمة', 'Value'),
                  tr('القيمة السابقة', 'Previous Value'),
                  tr('نسبة التغيير', '% Change'),
                  tr('القيمة المستهدفة', 'Target Value'),
                  tr('نقاط البيانات', 'Data Points'),
                  tr('تاريخ الحساب', 'Calculated At'),
                ].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-start">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {data.map(row => (
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 text-sm">{kpiCodeBadge(row.kpiCode)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{periodTypeLabel(row.periodType)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(row.periodStart)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{formatNumber(row.numericValue)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatNumber(row.previousValue)}</td>
                  <td className="px-4 py-3 text-sm">{percentChangeBadge(row.percentChange)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatNumber(row.targetValue)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.dataPoints ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(row.calculatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {tr(`الإجمالي: ${total}`, `Total: ${total}`)}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            >
              {tr('السابق', 'Previous')}
            </button>
            <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
              {tr(`صفحة ${page} من ${totalPages}`, `Page ${page} of ${totalPages}`)}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            >
              {tr('التالي', 'Next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
