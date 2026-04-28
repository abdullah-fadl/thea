'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';

interface AuditEntry {
  id: string;
  timestamp: string;
  actorUserId: string;
  actorName?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  boundedContext: string;
  ipAddress?: string;
  hashChainValid?: boolean;
  previousData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

const ACTION_OPTIONS = ['CREATE', 'UPDATE', 'DELETE', 'CONFIGURE', 'APPROVE', 'REJECT', 'ARCHIVE'] as const;
const RESOURCE_TYPE_OPTIONS = [
  'ITEM', 'PURCHASE_ORDER', 'VENDOR', 'GRN', 'WAREHOUSE', 'TRANSFER',
  'REQUISITION', 'CONTRACT', 'INVOICE', 'BUDGET', 'system_config', 'JOB_EXECUTION',
] as const;

export default function AuditLogsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [data, setData] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const pageSize = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set('actorUserId', search);
      if (actionFilter) params.set('action', actionFilter);
      if (resourceTypeFilter) params.set('resourceType', resourceTypeFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await fetch(`/api/imdad/admin/audit-logs?${params}`, { credentials: 'include' });
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
  }, [page, search, actionFilter, resourceTypeFilter, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formatDateTime = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
      dateStyle: 'short',
      timeStyle: 'medium',
    });
  };

  const actionBadge = (action: string) => {
    const map: Record<string, { color: string; label: string }> = {
      CREATE: { color: 'bg-[#6B8E23]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]', label: tr('إنشاء', 'Create') },
      UPDATE: { color: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#C4960C]/20 dark:text-[#E8A317]', label: tr('تحديث', 'Update') },
      DELETE: { color: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#A0522D]', label: tr('حذف', 'Delete') },
      CONFIGURE: { color: 'bg-[#556B2F]/10 text-[#556B2F] dark:bg-[#4A5D23]/20 dark:text-[#9CB86B]', label: tr('تهيئة', 'Configure') },
      APPROVE: { color: 'bg-[#6B8E23]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]', label: tr('موافقة', 'Approve') },
      REJECT: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', label: tr('رفض', 'Reject') },
      ARCHIVE: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', label: tr('أرشفة', 'Archive') },
    };
    const s = map[action] || { color: 'bg-gray-100 text-gray-800', label: action };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  const hashBadge = (valid?: boolean) => {
    if (valid === undefined) return <span className="text-xs text-gray-400">—</span>;
    return valid
      ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#6B8E23]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]">{tr('سلسلة صالحة', 'Chain Valid')}</span>
      : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#A0522D]">{tr('سلسلة غير صالحة', 'Chain Invalid')}</span>;
  };

  const actionFilterLabel = (a: string) => {
    const map: Record<string, string> = {
      CREATE: tr('إنشاء', 'Create'), UPDATE: tr('تحديث', 'Update'), DELETE: tr('حذف', 'Delete'),
      CONFIGURE: tr('تهيئة', 'Configure'), APPROVE: tr('موافقة', 'Approve'),
      REJECT: tr('رفض', 'Reject'), ARCHIVE: tr('أرشفة', 'Archive'),
    };
    return map[a] || a;
  };

  const renderDiff = (prev: Record<string, unknown> | undefined, next: Record<string, unknown> | undefined) => {
    if (!prev && !next) return <p className="text-sm text-gray-500 dark:text-gray-400">{tr('لا توجد بيانات تفصيلية', 'No detail data available')}</p>;
    const allKeys = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]);
    return (
      <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-start text-xs font-medium text-gray-500 dark:text-gray-400">{tr('الحقل', 'Field')}</th>
              <th className="px-3 py-2 text-start text-xs font-medium text-gray-500 dark:text-gray-400">{tr('القيمة السابقة', 'Previous')}</th>
              <th className="px-3 py-2 text-start text-xs font-medium text-gray-500 dark:text-gray-400">{tr('القيمة الجديدة', 'New')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {Array.from(allKeys).map((key) => {
              const pVal = prev?.[key];
              const nVal = next?.[key];
              const changed = JSON.stringify(pVal) !== JSON.stringify(nVal);
              return (
                <tr key={key} className={changed ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}>
                  <td className="px-3 py-1.5 font-mono text-gray-700 dark:text-gray-300">{key}</td>
                  <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{pVal !== undefined ? JSON.stringify(pVal) : '—'}</td>
                  <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{nVal !== undefined ? JSON.stringify(nVal) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4 md:space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {tr('سجلات المراجعة', 'Audit Logs')}
      </h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder={tr('بحث بمعرّف المستخدم...', 'Search by actor ID...')}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        />
        <select
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">{tr('جميع الإجراءات', 'All Actions')}</option>
          {ACTION_OPTIONS.map(a => (
            <option key={a} value={a}>{actionFilterLabel(a)}</option>
          ))}
        </select>
        <select
          value={resourceTypeFilter}
          onChange={e => { setResourceTypeFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">{tr('جميع أنواع الموارد', 'All Resource Types')}</option>
          {RESOURCE_TYPE_OPTIONS.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <input
          type="date"
          value={startDate}
          onChange={e => { setStartDate(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          title={tr('من تاريخ', 'From date')}
        />
        <input
          type="date"
          value={endDate}
          onChange={e => { setEndDate(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          title={tr('إلى تاريخ', 'To date')}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {tr('جارٍ التحميل...', 'Loading...')}
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {tr('لا توجد سجلات مراجعة', 'No audit logs found')}
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {[
                  tr('الوقت', 'Timestamp'),
                  tr('المستخدم', 'Actor'),
                  tr('الإجراء', 'Action'),
                  tr('نوع المورد', 'Resource Type'),
                  tr('معرّف المورد', 'Resource ID'),
                  tr('السياق', 'Bounded Context'),
                  tr('عنوان IP', 'IP Address'),
                  tr('التحقق', 'Verification'),
                ].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-start">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {data.map(row => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedEntry(row)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                >
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatDateTime(row.timestamp)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{row.actorName || row.actorUserId?.slice(0, 8) || '—'}</td>
                  <td className="px-4 py-3 text-sm">{actionBadge(row.action)}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-700 dark:text-gray-300">{row.resourceType}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-500 dark:text-gray-400">{row.resourceId?.slice(0, 8) || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.boundedContext || '—'}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-500 dark:text-gray-400">{row.ipAddress || '—'}</td>
                  <td className="px-4 py-3 text-sm">{hashBadge(row.hashChainValid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
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

      {/* Detail Sheet */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedEntry(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-xl bg-white dark:bg-gray-900 shadow-xl overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 space-y-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {tr('تفاصيل سجل المراجعة', 'Audit Log Detail')}
                </h2>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl"
                >
                  &times;
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">{tr('المعرّف', 'ID')}</p>
                  <p className="font-mono text-gray-900 dark:text-white">{selectedEntry.id}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">{tr('الوقت', 'Timestamp')}</p>
                  <p className="text-gray-900 dark:text-white">{formatDateTime(selectedEntry.timestamp)}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">{tr('المستخدم', 'Actor')}</p>
                  <p className="text-gray-900 dark:text-white">{selectedEntry.actorName || selectedEntry.actorUserId}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">{tr('الإجراء', 'Action')}</p>
                  <div>{actionBadge(selectedEntry.action)}</div>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">{tr('نوع المورد', 'Resource Type')}</p>
                  <p className="font-mono text-gray-900 dark:text-white">{selectedEntry.resourceType}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">{tr('معرّف المورد', 'Resource ID')}</p>
                  <p className="font-mono text-gray-900 dark:text-white">{selectedEntry.resourceId || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">{tr('السياق', 'Bounded Context')}</p>
                  <p className="text-gray-900 dark:text-white">{selectedEntry.boundedContext || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">{tr('عنوان IP', 'IP Address')}</p>
                  <p className="font-mono text-gray-900 dark:text-white">{selectedEntry.ipAddress || '—'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500 dark:text-gray-400 mb-1">{tr('التحقق من السلسلة', 'Hash Chain Verification')}</p>
                  {hashBadge(selectedEntry.hashChainValid)}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  {tr('مقارنة البيانات', 'Data Diff')}
                </h3>
                {renderDiff(selectedEntry.previousData, selectedEntry.newData)}
              </div>

              {selectedEntry.metadata && Object.keys(selectedEntry.metadata).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    {tr('بيانات إضافية', 'Metadata')}
                  </h3>
                  <pre className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
                    {JSON.stringify(selectedEntry.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
