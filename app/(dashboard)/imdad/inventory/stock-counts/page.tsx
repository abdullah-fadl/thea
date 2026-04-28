'use client';

import { useLang } from '@/hooks/use-lang';
import { useEffect, useState, useCallback } from 'react';

const COUNT_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

export default function StockCountsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [stockCounts, setStockCounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const limit = 20;

  const fetchStockCounts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/imdad/inventory/stock-counts?${params}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setStockCounts(json.stockCounts || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 0);
      }
    } catch (err) {
      console.error('Failed to fetch stock counts:', err);
    }
    setLoading(false);
  }, [page, statusFilter]);

  useEffect(() => {
    fetchStockCounts();
  }, [fetchStockCounts]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const statusLabel = (s: string) => {
    const map: Record<string, [string, string]> = {
      PLANNED: ['\u0645\u062E\u0637\u0637', 'Planned'],
      IN_PROGRESS: ['\u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630', 'In Progress'],
      COMPLETED: ['\u0645\u0643\u062A\u0645\u0644', 'Completed'],
      CANCELLED: ['\u0645\u0644\u063A\u0649', 'Cancelled'],
    };
    const pair = map[s];
    return pair ? tr(pair[0], pair[1]) : s;
  };

  const statusBadgeColor = (s: string) => {
    switch (s) {
      case 'PLANNED': return 'bg-[#D4A017]/15 text-[#C4960C] dark:bg-[#C4960C]/20 dark:text-[#E8A317]';
      case 'IN_PROGRESS': return 'bg-[#E8A317]/15 text-[#C4960C] dark:bg-[#E8A317]/20 dark:text-[#E8A317]';
      case 'COMPLETED': return 'bg-[#6B8E23]/15 text-[#4A5D23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]';
      case 'CANCELLED': return 'bg-[#8B4513]/15 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#D4A017]';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '-';
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {tr('\u062C\u0631\u062F \u0627\u0644\u0645\u062E\u0632\u0648\u0646', 'Stock Counts')}
        </h1>
        <button className="rounded-lg bg-[#D4A017] px-4 py-2 text-sm font-medium text-white hover:bg-[#C4960C] transition-colors">
          {tr('\u062C\u0631\u062F \u062C\u062F\u064A\u062F', 'New Count')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none"
        >
          <option value="">{tr('\u0643\u0644 \u0627\u0644\u062D\u0627\u0644\u0627\u062A', 'All Statuses')}</option>
          {COUNT_STATUSES.map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {[
                tr('\u0627\u0633\u0645 \u0627\u0644\u062C\u0631\u062F', 'Count Name'),
                tr('\u0627\u0644\u0646\u0648\u0639', 'Type'),
                tr('\u0627\u0644\u0645\u0648\u0642\u0639', 'Location'),
                tr('\u0627\u0644\u062D\u0627\u0644\u0629', 'Status'),
                tr('\u0627\u0644\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0645\u062E\u0637\u0637', 'Planned Date'),
                tr('\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0643\u0645\u0627\u0644', 'Completed Date'),
                tr('\u0645\u0644\u0627\u062D\u0638\u0627\u062A', 'Notes'),
                tr('\u0627\u0644\u0625\u062C\u0631\u0627\u0621\u0627\u062A', 'Actions'),
              ].map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  {tr('\u062C\u0627\u0631\u064D \u0627\u0644\u062A\u062D\u0645\u064A\u0644...', 'Loading...')}
                </td>
              </tr>
            ) : stockCounts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  {tr('\u0644\u0627 \u062A\u0648\u062C\u062F \u0639\u0645\u0644\u064A\u0627\u062A \u062C\u0631\u062F', 'No stock counts found')}
                </td>
              </tr>
            ) : (
              stockCounts.map((sc) => (
                <tr key={sc.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {sc.name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {sc.countType || '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {sc.locationId || '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeColor(sc.status)}`}>
                      {statusLabel(sc.status)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {formatDate(sc.scheduledDate)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {formatDate(sc.completedDate)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-[200px] truncate">
                    {sc.notes || '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <button className="text-[#D4A017] hover:text-[#C4960C] dark:text-[#E8A317] dark:hover:text-[#E8A317] text-xs font-medium">
                      {tr('\u0639\u0631\u0636', 'View')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {tr(
              `\u0639\u0631\u0636 ${(page - 1) * limit + 1} - ${Math.min(page * limit, total)} \u0645\u0646 ${total}`,
              `Showing ${(page - 1) * limit + 1} - ${Math.min(page * limit, total)} of ${total}`
            )}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {tr('\u0627\u0644\u0633\u0627\u0628\u0642', 'Previous')}
            </button>
            <span className="flex items-center px-3 text-sm text-gray-600 dark:text-gray-400">
              {tr(`\u0635\u0641\u062D\u0629 ${page} \u0645\u0646 ${totalPages}`, `Page ${page} of ${totalPages}`)}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {tr('\u0627\u0644\u062A\u0627\u0644\u064A', 'Next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
