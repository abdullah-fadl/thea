'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';

interface VendorAudit {
  _id: string;
  auditNumber: string;
  vendorName: string;
  auditType: string;
  plannedDate: string;
  outcome: string;
  findingsCount: number;
  capaRequired: boolean;
  status: string;
}

const OUTCOME_OPTIONS = ['COMPLIANT', 'MINOR_FINDINGS', 'MAJOR_FINDINGS', 'CRITICAL_FINDINGS', 'NON_COMPLIANT'] as const;
const TYPE_OPTIONS = ['INITIAL', 'PERIODIC', 'FOR_CAUSE', 'RE_AUDIT'] as const;

export default function VendorAuditsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [data, setData] = useState<VendorAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (outcomeFilter) params.set('outcome', outcomeFilter);
      if (typeFilter) params.set('auditType', typeFilter);
      const res = await fetch(`/api/imdad/quality/vendor-audits?${params}`, { credentials: 'include' });
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
  }, [page, search, outcomeFilter, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const outcomeBadge = (outcome: string) => {
    const map: Record<string, { color: string; label: string }> = {
      COMPLIANT: { color: 'bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]', label: tr('ملتزم', 'Compliant') },
      MINOR_FINDINGS: { color: 'bg-[#E8A317]/10 text-[#E8A317] dark:bg-[#E8A317]/20 dark:text-[#E8A317]', label: tr('ملاحظات بسيطة', 'Minor Findings') },
      MAJOR_FINDINGS: { color: 'bg-[#D4A017]/15 text-[#C4960C] dark:bg-[#C4960C]/20 dark:text-[#E8A317]', label: tr('ملاحظات جوهرية', 'Major Findings') },
      CRITICAL_FINDINGS: { color: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#D2691E]', label: tr('ملاحظات حرجة', 'Critical Findings') },
      NON_COMPLIANT: { color: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#D2691E]', label: tr('غير ملتزم', 'Non-Compliant') },
    };
    const s = map[outcome] || { color: 'bg-gray-100 text-gray-800', label: outcome };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  const auditTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      INITIAL: tr('أولي', 'Initial'),
      PERIODIC: tr('دوري', 'Periodic'),
      FOR_CAUSE: tr('لسبب', 'For Cause'),
      RE_AUDIT: tr('إعادة تدقيق', 'Re-Audit'),
    };
    return map[type] || type;
  };

  const outcomeFilterLabel = (s: string) => {
    const map: Record<string, string> = {
      COMPLIANT: tr('ملتزم', 'Compliant'),
      MINOR_FINDINGS: tr('ملاحظات بسيطة', 'Minor Findings'),
      MAJOR_FINDINGS: tr('ملاحظات جوهرية', 'Major Findings'),
      CRITICAL_FINDINGS: tr('ملاحظات حرجة', 'Critical Findings'),
      NON_COMPLIANT: tr('غير ملتزم', 'Non-Compliant'),
    };
    return map[s] || s;
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { color: string; label: string }> = {
      PLANNED: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', label: tr('مخطط', 'Planned') },
      IN_PROGRESS: { color: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#C4960C]/20 dark:text-[#E8A317]', label: tr('قيد التنفيذ', 'In Progress') },
      COMPLETED: { color: 'bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]', label: tr('مكتمل', 'Completed') },
      CANCELLED: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', label: tr('ملغي', 'Cancelled') },
    };
    const s = map[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US');
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4 md:space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {tr('تدقيق الموردين', 'Vendor Audits')}
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
          value={outcomeFilter}
          onChange={e => { setOutcomeFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">{tr('جميع النتائج', 'All Outcomes')}</option>
          {OUTCOME_OPTIONS.map(o => (
            <option key={o} value={o}>{outcomeFilterLabel(o)}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">{tr('جميع الأنواع', 'All Types')}</option>
          {TYPE_OPTIONS.map(t => (
            <option key={t} value={t}>{auditTypeLabel(t)}</option>
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
          {tr('لا توجد عمليات تدقيق', 'No audits found')}
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {[
                  tr('رقم التدقيق', 'Audit #'),
                  tr('المورد', 'Vendor'),
                  tr('النوع', 'Type'),
                  tr('التاريخ المخطط', 'Planned Date'),
                  tr('النتيجة', 'Outcome'),
                  tr('الملاحظات', 'Findings'),
                  tr('CAPA مطلوب', 'CAPA Required'),
                  tr('الحالة', 'Status'),
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
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{row.auditNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.vendorName || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{auditTypeLabel(row.auditType)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(row.plannedDate)}</td>
                  <td className="px-4 py-3 text-sm">{row.outcome ? outcomeBadge(row.outcome) : <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.findingsCount ?? '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    {row.capaRequired ? (
                      <span className="text-[#6B8E23] dark:text-[#9CB86B] font-medium">&#10003;</span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">&#10007;</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{statusBadge(row.status)}</td>
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
