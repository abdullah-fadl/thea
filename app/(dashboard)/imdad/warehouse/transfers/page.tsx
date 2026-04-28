'use client';

import { useLang } from '@/hooks/use-lang';
import { useEffect, useState, useCallback } from 'react';

const STATUS_OPTIONS = ['DRAFT', 'REQUESTED', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'COMPLETED', 'CANCELLED', 'REJECTED'] as const;
const TRANSFER_TYPES = ['INTER_WAREHOUSE', 'INTER_DEPARTMENT', 'REPLENISHMENT', 'RETURN', 'EMERGENCY'] as const;

export default function TransfersPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('transferType', typeFilter);
      const res = await fetch(`/api/imdad/warehouse/transfers?${params}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setData(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 0);
      }
    } catch (err) {
      console.error('Failed to fetch transfers:', err);
    }
    setLoading(false);
  }, [page, search, statusFilter, typeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, typeFilter]);

  const handleSearch = () => {
    setSearch(searchInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const statusLabel = (s: string) => {
    const map: Record<string, [string, string]> = {
      DRAFT: ['\u0645\u0633\u0648\u062F\u0629', 'Draft'],
      REQUESTED: ['\u0645\u0637\u0644\u0648\u0628', 'Requested'],
      APPROVED: ['\u0645\u0648\u0627\u0641\u0642 \u0639\u0644\u064A\u0647', 'Approved'],
      IN_TRANSIT: ['\u0641\u064A \u0627\u0644\u0637\u0631\u064A\u0642', 'In Transit'],
      RECEIVED: ['\u0645\u0633\u062A\u0644\u0645', 'Received'],
      COMPLETED: ['\u0645\u0643\u062A\u0645\u0644', 'Completed'],
      CANCELLED: ['\u0645\u0644\u063A\u064A', 'Cancelled'],
      REJECTED: ['\u0645\u0631\u0641\u0648\u0636', 'Rejected'],
    };
    const pair = map[s];
    return pair ? tr(pair[0], pair[1]) : s;
  };

  const transferTypeLabel = (t: string) => {
    const map: Record<string, [string, string]> = {
      INTER_WAREHOUSE: ['\u0628\u064A\u0646 \u0627\u0644\u0645\u0633\u062A\u0648\u062F\u0639\u0627\u062A', 'Inter-Warehouse'],
      INTER_DEPARTMENT: ['\u0628\u064A\u0646 \u0627\u0644\u0623\u0642\u0633\u0627\u0645', 'Inter-Department'],
      REPLENISHMENT: ['\u062A\u062C\u062F\u064A\u062F \u0627\u0644\u0645\u062E\u0632\u0648\u0646', 'Replenishment'],
      RETURN: ['\u0625\u0631\u062C\u0627\u0639', 'Return'],
      EMERGENCY: ['\u0637\u0648\u0627\u0631\u0626', 'Emergency'],
    };
    const pair = map[t];
    return pair ? tr(pair[0], pair[1]) : t;
  };

  const statusBadgeColor = (s: string) => {
    switch (s) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'REQUESTED': return 'bg-[#D4A017]/15 text-[#C4960C] dark:bg-[#C4960C]/20 dark:text-[#E8A317]';
      case 'APPROVED': return 'bg-[#556B2F]/15 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]';
      case 'IN_TRANSIT': return 'bg-[#E8A317]/15 text-[#C4960C] dark:bg-[#E8A317]/20 dark:text-[#E8A317]';
      case 'RECEIVED': return 'bg-[#6B8E23]/15 text-[#4A5D23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]';
      case 'COMPLETED': return 'bg-[#6B8E23]/15 text-[#4A5D23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]';
      case 'CANCELLED': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'REJECTED': return 'bg-[#8B4513]/15 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#D4A017]';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const priorityBadgeColor = (p: string) => {
    switch (p) {
      case 'LOW': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'NORMAL': return 'bg-[#D4A017]/15 text-[#C4960C] dark:bg-[#C4960C]/20 dark:text-[#E8A317]';
      case 'HIGH': return 'bg-[#E8A317]/15 text-[#C4960C] dark:bg-[#E8A317]/20 dark:text-[#E8A317]';
      case 'EMERGENCY': return 'bg-[#8B4513]/15 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#D4A017]';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const priorityLabel = (p: string) => {
    const map: Record<string, [string, string]> = {
      LOW: ['\u0645\u0646\u062E\u0641\u0636', 'Low'],
      NORMAL: ['\u0639\u0627\u062F\u064A', 'Normal'],
      HIGH: ['\u0639\u0627\u0644\u064A', 'High'],
      EMERGENCY: ['\u0637\u0648\u0627\u0631\u0626', 'Emergency'],
    };
    const pair = map[p];
    return pair ? tr(pair[0], pair[1]) : p;
  };

  const formatDate = (d: string) => {
    if (!d) return '-';
    try {
      return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return d;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {tr('\u0627\u0644\u062A\u062D\u0648\u064A\u0644\u0627\u062A', 'Transfers')}
        </h1>
        <button className="rounded-lg bg-[#D4A017] px-4 py-2 text-sm font-medium text-white hover:bg-[#C4960C] transition-colors">
          {tr('\u0625\u0646\u0634\u0627\u0621 \u062A\u062D\u0648\u064A\u0644', 'Create Transfer')}
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex flex-1 gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={tr('\u0628\u062D\u062B \u0628\u0631\u0642\u0645 \u0627\u0644\u062A\u062D\u0648\u064A\u0644...', 'Search by transfer number...')}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017]"
          />
          <button
            onClick={handleSearch}
            className="rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {tr('\u0628\u062D\u062B', 'Search')}
          </button>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none"
        >
          <option value="">{tr('\u0643\u0644 \u0627\u0644\u062D\u0627\u0644\u0627\u062A', 'All Statuses')}</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none"
        >
          <option value="">{tr('\u0643\u0644 \u0627\u0644\u0623\u0646\u0648\u0627\u0639', 'All Types')}</option>
          {TRANSFER_TYPES.map((t) => (
            <option key={t} value={t}>{transferTypeLabel(t)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {[
                tr('\u0631\u0642\u0645 \u0627\u0644\u062A\u062D\u0648\u064A\u0644', 'Transfer #'),
                tr('\u0627\u0644\u0646\u0648\u0639', 'Type'),
                tr('\u0627\u0644\u0645\u0635\u062F\u0631', 'Source'),
                tr('\u0627\u0644\u0648\u062C\u0647\u0629', 'Destination'),
                tr('\u0627\u0644\u0623\u0648\u0644\u0648\u064A\u0629', 'Priority'),
                tr('\u0627\u0644\u062D\u0627\u0644\u0629', 'Status'),
                tr('\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0637\u0644\u0628', 'Requested At'),
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
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  {tr('\u0644\u0627 \u062A\u0648\u062C\u062F \u062A\u062D\u0648\u064A\u0644\u0627\u062A', 'No transfers found')}
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">
                    {item.transferNumber}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {transferTypeLabel(item.transferType)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {item.sourceName || '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {item.destinationName || '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${priorityBadgeColor(item.priority)}`}>
                      {priorityLabel(item.priority)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeColor(item.status)}`}>
                      {statusLabel(item.status)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {formatDate(item.requestedAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <div className="flex gap-2">
                      <button className="text-[#D4A017] hover:text-[#C4960C] dark:text-[#E8A317] dark:hover:text-[#E8A317] text-xs font-medium">
                        {tr('\u0639\u0631\u0636', 'View')}
                      </button>
                      <button className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 text-xs font-medium">
                        {tr('\u062A\u0639\u062F\u064A\u0644', 'Edit')}
                      </button>
                    </div>
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
