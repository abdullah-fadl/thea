'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';

interface NCR {
  _id: string;
  ncrNumber: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  reportedBy: string;
  reportedAt: string;
}

const STATUS_OPTIONS = ['OPEN', 'INVESTIGATING', 'ROOT_CAUSE_IDENTIFIED', 'CORRECTIVE_ACTION', 'CLOSED', 'VOIDED'] as const;
const SEVERITY_OPTIONS = ['CRITICAL', 'MAJOR', 'MINOR'] as const;
const CATEGORY_OPTIONS = ['RECEIVING', 'STORAGE', 'DISPENSING', 'DOCUMENTATION', 'PROCESS'] as const;

export default function NonConformanceReportsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [data, setData] = useState<NCR[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (severityFilter) params.set('severity', severityFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      const res = await fetch(`/api/imdad/quality/ncr?${params}`, { credentials: 'include' });
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
  }, [page, search, statusFilter, severityFilter, categoryFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const statusBadge = (status: string) => {
    const map: Record<string, { color: string; label: string }> = {
      OPEN: { color: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#D2691E]', label: tr('مفتوح', 'Open') },
      INVESTIGATING: { color: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#C4960C]/20 dark:text-[#E8A317]', label: tr('قيد التحقيق', 'Investigating') },
      ROOT_CAUSE_IDENTIFIED: { color: 'bg-[#E8A317]/10 text-[#E8A317] dark:bg-[#E8A317]/20 dark:text-[#E8A317]', label: tr('تم تحديد السبب', 'Root Cause Identified') },
      CORRECTIVE_ACTION: { color: 'bg-[#D4A017]/15 text-[#C4960C] dark:bg-[#C4960C]/20 dark:text-[#E8A317]', label: tr('إجراء تصحيحي', 'Corrective Action') },
      CLOSED: { color: 'bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]', label: tr('مغلق', 'Closed') },
      VOIDED: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', label: tr('ملغي', 'Voided') },
    };
    const s = map[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  const severityBadge = (severity: string) => {
    const map: Record<string, { color: string; label: string }> = {
      CRITICAL: { color: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#D2691E]', label: tr('حرج', 'Critical') },
      MAJOR: { color: 'bg-[#D4A017]/15 text-[#C4960C] dark:bg-[#C4960C]/20 dark:text-[#E8A317]', label: tr('جوهري', 'Major') },
      MINOR: { color: 'bg-[#E8A317]/10 text-[#E8A317] dark:bg-[#E8A317]/20 dark:text-[#E8A317]', label: tr('بسيط', 'Minor') },
    };
    const s = map[severity] || { color: 'bg-gray-100 text-gray-800', label: severity };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  const categoryLabel = (cat: string) => {
    const map: Record<string, string> = {
      RECEIVING: tr('استلام', 'Receiving'),
      STORAGE: tr('تخزين', 'Storage'),
      DISPENSING: tr('صرف', 'Dispensing'),
      DOCUMENTATION: tr('توثيق', 'Documentation'),
      PROCESS: tr('عملية', 'Process'),
    };
    return map[cat] || cat;
  };

  const statusFilterLabel = (s: string) => {
    const map: Record<string, string> = {
      OPEN: tr('مفتوح', 'Open'),
      INVESTIGATING: tr('قيد التحقيق', 'Investigating'),
      ROOT_CAUSE_IDENTIFIED: tr('تم تحديد السبب', 'Root Cause Identified'),
      CORRECTIVE_ACTION: tr('إجراء تصحيحي', 'Corrective Action'),
      CLOSED: tr('مغلق', 'Closed'),
      VOIDED: tr('ملغي', 'Voided'),
    };
    return map[s] || s;
  };

  const severityFilterLabel = (s: string) => {
    const map: Record<string, string> = {
      CRITICAL: tr('حرج', 'Critical'),
      MAJOR: tr('جوهري', 'Major'),
      MINOR: tr('بسيط', 'Minor'),
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
        {tr('تقارير عدم المطابقة', 'Non-Conformance Reports')}
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
        <select
          value={categoryFilter}
          onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">{tr('جميع الفئات', 'All Categories')}</option>
          {CATEGORY_OPTIONS.map(c => (
            <option key={c} value={c}>{categoryLabel(c)}</option>
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
          {tr('لا توجد تقارير', 'No reports found')}
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {[
                  tr('رقم التقرير', 'NCR #'),
                  tr('العنوان', 'Title'),
                  tr('الفئة', 'Category'),
                  tr('الخطورة', 'Severity'),
                  tr('الحالة', 'Status'),
                  tr('أبلغ بواسطة', 'Reported By'),
                  tr('تاريخ الإبلاغ', 'Reported At'),
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
                <tr key={row._id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{row.ncrNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.title || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{categoryLabel(row.category)}</td>
                  <td className="px-4 py-3 text-sm">{severityBadge(row.severity)}</td>
                  <td className="px-4 py-3 text-sm">{statusBadge(row.status)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.reportedBy || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(row.reportedAt)}</td>
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
