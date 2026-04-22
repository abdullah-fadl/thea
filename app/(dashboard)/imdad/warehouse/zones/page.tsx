'use client';

import { useLang } from '@/hooks/use-lang';
import { useEffect, useState, useCallback } from 'react';

const ZONE_TYPES = ['GENERAL', 'COLD_CHAIN', 'CONTROLLED', 'HAZMAT', 'HIGH_VALUE', 'QUARANTINE', 'RECEIVING', 'STAGING', 'RETURNS'] as const;

export default function ZonesBinsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [zoneTypeFilter, setZoneTypeFilter] = useState('');
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (zoneTypeFilter) params.set('zoneType', zoneTypeFilter);
      const res = await fetch(`/api/imdad/warehouse/zones?${params}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setData(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 0);
      }
    } catch (err) {
      console.error('Failed to fetch zones:', err);
    }
    setLoading(false);
  }, [page, search, zoneTypeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [search, zoneTypeFilter]);

  const handleSearch = () => {
    setSearch(searchInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const zoneTypeLabel = (t: string) => {
    const map: Record<string, [string, string]> = {
      GENERAL: ['\u0639\u0627\u0645', 'General'],
      COLD_CHAIN: ['\u0633\u0644\u0633\u0644\u0629 \u0627\u0644\u062A\u0628\u0631\u064A\u062F', 'Cold Chain'],
      CONTROLLED: ['\u0645\u0631\u0627\u0642\u0628', 'Controlled'],
      HAZMAT: ['\u0645\u0648\u0627\u062F \u062E\u0637\u0631\u0629', 'Hazmat'],
      HIGH_VALUE: ['\u0639\u0627\u0644\u064A \u0627\u0644\u0642\u064A\u0645\u0629', 'High Value'],
      QUARANTINE: ['\u062D\u062C\u0631 \u0635\u062D\u064A', 'Quarantine'],
      RECEIVING: ['\u0627\u0633\u062A\u0644\u0627\u0645', 'Receiving'],
      STAGING: ['\u062A\u062C\u0647\u064A\u0632', 'Staging'],
      RETURNS: ['\u0645\u0631\u062A\u062C\u0639\u0627\u062A', 'Returns'],
    };
    const pair = map[t];
    return pair ? tr(pair[0], pair[1]) : t;
  };

  const tempZoneLabel = (t: string) => {
    const map: Record<string, [string, string]> = {
      AMBIENT: ['\u0645\u062D\u064A\u0637', 'Ambient'],
      COOL: ['\u0628\u0627\u0631\u062F', 'Cool'],
      FROZEN: ['\u0645\u062C\u0645\u062F', 'Frozen'],
      DEEP_FROZEN: ['\u0645\u062C\u0645\u062F \u0639\u0645\u064A\u0642', 'Deep Frozen'],
      ULTRA_COLD: ['\u0634\u062F\u064A\u062F \u0627\u0644\u0628\u0631\u0648\u062F\u0629', 'Ultra Cold'],
    };
    const pair = map[t];
    return pair ? tr(pair[0], pair[1]) : t || '-';
  };

  const statusBadgeColor = (isActive: boolean) => {
    return isActive
      ? 'bg-[#6B8E23]/15 text-[#4A5D23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]'
      : 'bg-[#8B4513]/15 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#D4A017]';
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {tr('\u0627\u0644\u0645\u0646\u0627\u0637\u0642 \u0648\u0627\u0644\u0635\u0646\u0627\u062F\u064A\u0642', 'Zones & Bins')}
        </h1>
        <button className="rounded-lg bg-[#D4A017] px-4 py-2 text-sm font-medium text-white hover:bg-[#C4960C] transition-colors">
          {tr('\u0625\u0636\u0627\u0641\u0629 \u0645\u0646\u0637\u0642\u0629', 'Add Zone')}
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
            placeholder={tr('\u0628\u062D\u062B \u0628\u0627\u0644\u0627\u0633\u0645 \u0623\u0648 \u0627\u0644\u0631\u0645\u0632...', 'Search by name or code...')}
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
          value={zoneTypeFilter}
          onChange={(e) => setZoneTypeFilter(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none"
        >
          <option value="">{tr('\u0643\u0644 \u0627\u0644\u0623\u0646\u0648\u0627\u0639', 'All Types')}</option>
          {ZONE_TYPES.map((t) => (
            <option key={t} value={t}>{zoneTypeLabel(t)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {[
                tr('\u0631\u0645\u0632 \u0627\u0644\u0645\u0646\u0637\u0642\u0629', 'Zone Code'),
                tr('\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u0637\u0642\u0629', 'Zone Name'),
                tr('\u0627\u0644\u0646\u0648\u0639', 'Type'),
                tr('\u0627\u0644\u0645\u0633\u062A\u0648\u062F\u0639', 'Warehouse'),
                tr('\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062D\u0631\u0627\u0631\u0629', 'Temp Zone'),
                tr('\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0635\u0646\u0627\u062F\u064A\u0642', 'Total Bins'),
                tr('\u0627\u0644\u0635\u0646\u0627\u062F\u064A\u0642 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u0629', 'Used Bins'),
                tr('\u0627\u0644\u062D\u0627\u0644\u0629', 'Status'),
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
                  {tr('\u0644\u0627 \u062A\u0648\u062C\u062F \u0645\u0646\u0627\u0637\u0642', 'No zones found')}
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">
                    {item.zoneCode}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    {language === 'ar' && item.zoneNameAr ? item.zoneNameAr : item.zoneName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {zoneTypeLabel(item.zoneType)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {item.warehouseName || '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {tempZoneLabel(item.temperatureZone)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {item.totalBins ?? 0}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {item.usedBins ?? 0}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeColor(item.isActive)}`}>
                      {item.isActive ? tr('\u0646\u0634\u0637', 'Active') : tr('\u063A\u064A\u0631 \u0646\u0634\u0637', 'Inactive')}
                    </span>
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
