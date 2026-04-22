'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';

interface AlertInstance {
  id: string;
  ruleCode: string;
  ruleName: string;
  severity: string;
  kpiCode: string;
  actualValue: number;
  thresholdValue: number;
  status: string;
  firedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

const STATUS_OPTIONS = ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'] as const;
const SEVERITY_OPTIONS = ['INFO', 'WARNING', 'CRITICAL'] as const;

export default function AnalyticsAlertsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [data, setData] = useState<AlertInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (severityFilter) params.set('severity', severityFilter);
      const res = await fetch(`/api/imdad/analytics/alert-instances?${params}`, { credentials: 'include' });
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
  }, [page, search, statusFilter, severityFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const severityBadge = (severity: string) => {
    const map: Record<string, { color: string; label: string }> = {
      INFO: { color: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#C4960C]/20 dark:text-[#E8A317]', label: tr('معلومات', 'Info') },
      WARNING: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', label: tr('تحذير', 'Warning') },
      CRITICAL: { color: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#A0522D]', label: tr('حرج', 'Critical') },
    };
    const s = map[severity] || { color: 'bg-gray-100 text-gray-800', label: severity };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { color: string; label: string }> = {
      ACTIVE: { color: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#A0522D]', label: tr('نشط', 'Active') },
      ACKNOWLEDGED: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', label: tr('تم الإقرار', 'Acknowledged') },
      RESOLVED: { color: 'bg-[#6B8E23]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]', label: tr('تم الحل', 'Resolved') },
      DISMISSED: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', label: tr('مرفوض', 'Dismissed') },
    };
    const s = map[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  const statusFilterLabel = (s: string) => {
    const map: Record<string, string> = {
      ACTIVE: tr('نشط', 'Active'),
      ACKNOWLEDGED: tr('تم الإقرار', 'Acknowledged'),
      RESOLVED: tr('تم الحل', 'Resolved'),
      DISMISSED: tr('مرفوض', 'Dismissed'),
    };
    return map[s] || s;
  };

  const severityFilterLabel = (s: string) => {
    const map: Record<string, string> = {
      INFO: tr('معلومات', 'Info'),
      WARNING: tr('تحذير', 'Warning'),
      CRITICAL: tr('حرج', 'Critical'),
    };
    return map[s] || s;
  };

  const formatDate = (d: string | null) => {
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
        {tr('تنبيهات التحليلات', 'Analytics Alerts')}
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
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">{tr('جميع الحالات', 'All Statuses')}</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{statusFilterLabel(s)}</option>
          ))}
        </select>
        <select
          value={severityFilter}
          onChange={e => { setSeverityFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">{tr('جميع مستويات الخطورة', 'All Severities')}</option>
          {SEVERITY_OPTIONS.map(s => (
            <option key={s} value={s}>{severityFilterLabel(s)}</option>
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
          {tr('لا توجد تنبيهات', 'No alerts found')}
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {[
                  tr('رمز القاعدة', 'Rule Code'),
                  tr('اسم القاعدة', 'Rule Name'),
                  tr('الخطورة', 'Severity'),
                  tr('مؤشر الأداء', 'KPI Code'),
                  tr('القيمة الفعلية', 'Actual Value'),
                  tr('قيمة الحد', 'Threshold'),
                  tr('الحالة', 'Status'),
                  tr('تاريخ الإطلاق', 'Fired At'),
                  tr('تاريخ الإقرار', 'Acknowledged At'),
                  tr('تاريخ الحل', 'Resolved At'),
                  tr('الإجراءات', 'Actions'),
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
                  <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">{row.ruleCode}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{row.ruleName}</td>
                  <td className="px-4 py-3 text-sm">{severityBadge(row.severity)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.kpiCode || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatNumber(row.actualValue)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatNumber(row.thresholdValue)}</td>
                  <td className="px-4 py-3 text-sm">{statusBadge(row.status)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(row.firedAt)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(row.acknowledgedAt)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(row.resolvedAt)}</td>
                  <td className="px-4 py-3 text-sm">
                    <button className="text-[#D4A017] hover:text-[#C4960C] dark:text-[#E8A317] dark:hover:text-[#E8A317] text-sm">
                      {tr('عرض', 'View')}
                    </button>
                  </td>
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
