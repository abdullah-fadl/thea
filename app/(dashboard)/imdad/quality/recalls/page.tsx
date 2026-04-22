'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';

interface Recall {
  _id: string;
  recallNumber: string;
  severity: string;
  itemName: string;
  vendorName: string;
  status: string;
  quantityAffected: number;
  quantityRecovered: number;
  sfdaNotified: boolean;
  initiatedAt: string;
}

const STATUS_OPTIONS = ['DRAFT', 'INITIATED', 'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'COMPLETED', 'CLOSED', 'CANCELLED'] as const;
const SEVERITY_OPTIONS = ['CLASS_I', 'CLASS_II', 'CLASS_III', 'VOLUNTARY'] as const;

export default function ProductRecallsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [data, setData] = useState<Recall[]>([]);
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
      const res = await fetch(`/api/imdad/quality/recalls?${params}`, { credentials: 'include' });
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

  const statusBadge = (status: string) => {
    const map: Record<string, { color: string; label: string }> = {
      DRAFT: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', label: tr('مسودة', 'Draft') },
      INITIATED: { color: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#C4960C]/20 dark:text-[#E8A317]', label: tr('بدأ', 'Initiated') },
      IN_PROGRESS: { color: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#C4960C]/20 dark:text-[#E8A317]', label: tr('قيد التنفيذ', 'In Progress') },
      PARTIALLY_COMPLETED: { color: 'bg-[#E8A317]/10 text-[#E8A317] dark:bg-[#E8A317]/20 dark:text-[#E8A317]', label: tr('مكتمل جزئياً', 'Partially Completed') },
      COMPLETED: { color: 'bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]', label: tr('مكتمل', 'Completed') },
      CLOSED: { color: 'bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]', label: tr('مغلق', 'Closed') },
      CANCELLED: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', label: tr('ملغي', 'Cancelled') },
    };
    const s = map[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  const severityBadge = (severity: string) => {
    const map: Record<string, { color: string; label: string }> = {
      CLASS_I: { color: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#D2691E]', label: tr('خطير', 'Critical') },
      CLASS_II: { color: 'bg-[#D4A017]/15 text-[#C4960C] dark:bg-[#C4960C]/20 dark:text-[#E8A317]', label: tr('متوسط', 'Moderate') },
      CLASS_III: { color: 'bg-[#E8A317]/10 text-[#E8A317] dark:bg-[#E8A317]/20 dark:text-[#E8A317]', label: tr('منخفض', 'Low Risk') },
      VOLUNTARY: { color: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#C4960C]/20 dark:text-[#E8A317]', label: tr('طوعي', 'Voluntary') },
    };
    const s = map[severity] || { color: 'bg-gray-100 text-gray-800', label: severity };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  const severityFilterLabel = (s: string) => {
    const map: Record<string, string> = {
      CLASS_I: tr('خطير', 'Critical'),
      CLASS_II: tr('متوسط', 'Moderate'),
      CLASS_III: tr('منخفض', 'Low Risk'),
      VOLUNTARY: tr('طوعي', 'Voluntary'),
    };
    return map[s] || s;
  };

  const statusFilterLabel = (s: string) => {
    const map: Record<string, string> = {
      DRAFT: tr('مسودة', 'Draft'),
      INITIATED: tr('بدأ', 'Initiated'),
      IN_PROGRESS: tr('قيد التنفيذ', 'In Progress'),
      PARTIALLY_COMPLETED: tr('مكتمل جزئياً', 'Partially Completed'),
      COMPLETED: tr('مكتمل', 'Completed'),
      CLOSED: tr('مغلق', 'Closed'),
      CANCELLED: tr('ملغي', 'Cancelled'),
    };
    return map[s] || s;
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US');
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4 md:space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {tr('عمليات الاسترجاع', 'Product Recalls')}
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
          <option value="">{tr('جميع الخطورة', 'All Severities')}</option>
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
          {tr('لا توجد عمليات استرجاع', 'No recalls found')}
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {[
                  tr('رقم الاسترجاع', 'Recall #'),
                  tr('الخطورة', 'Severity'),
                  tr('الصنف', 'Item'),
                  tr('المورد', 'Vendor'),
                  tr('الحالة', 'Status'),
                  tr('الكمية المتأثرة', 'Qty Affected'),
                  tr('الكمية المستردة', 'Qty Recovered'),
                  tr('إخطار SFDA', 'SFDA Notified'),
                  tr('تاريخ البدء', 'Initiated At'),
                ].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-start">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {data.map(row => (
                <tr key={row._id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{row.recallNumber}</td>
                  <td className="px-4 py-3 text-sm">{severityBadge(row.severity)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.itemName || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.vendorName || '—'}</td>
                  <td className="px-4 py-3 text-sm">{statusBadge(row.status)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.quantityAffected ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.quantityRecovered ?? '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    {row.sfdaNotified ? (
                      <span className="text-[#6B8E23] dark:text-[#9CB86B] font-medium">&#10003;</span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">&#10007;</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(row.initiatedAt)}</td>
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
