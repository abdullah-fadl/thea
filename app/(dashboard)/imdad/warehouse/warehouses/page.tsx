'use client';

import { useLang } from '@/hooks/use-lang';
import { useEffect, useState, useCallback } from 'react';
import { WarehouseFormDialog } from '@/components/imdad/warehouse/WarehouseFormDialog';
import { WarehouseDetailSheet } from '@/components/imdad/warehouse/WarehouseDetailSheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const FACILITY_TYPES = ['CENTRAL', 'SATELLITE', 'DISTRIBUTION', 'PHARMACY'] as const;

export default function WarehousesPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [facilityTypeFilter, setFacilityTypeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const limit = 20;

  // Dialog / Sheet state
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editWarehouse, setEditWarehouse] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailWarehouseId, setDetailWarehouseId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (facilityTypeFilter) params.set('facilityType', facilityTypeFilter);
      if (activeFilter) params.set('isActive', activeFilter);
      const res = await fetch(`/api/imdad/warehouse/warehouses?${params}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setData(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 0);
      }
    } catch (err) {
      console.error('Failed to fetch warehouses:', err);
    }
    setLoading(false);
  }, [page, search, facilityTypeFilter, activeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [search, facilityTypeFilter, activeFilter]);

  const handleSearch = () => {
    setSearch(searchInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleRowClick = (item: any) => {
    setDetailWarehouseId(item.id);
    setDetailOpen(true);
  };

  const handleEditFromSheet = (warehouse: any) => {
    setDetailOpen(false);
    setEditWarehouse(warehouse);
    setEditOpen(true);
  };

  const facilityTypeLabel = (t: string) => {
    const map: Record<string, [string, string]> = {
      CENTRAL: ['\u0645\u0631\u0643\u0632\u064A', 'Central'],
      SATELLITE: ['\u0641\u0631\u0639\u064A', 'Satellite'],
      DISTRIBUTION: ['\u062A\u0648\u0632\u064A\u0639', 'Distribution'],
      PHARMACY: ['\u0635\u064A\u062F\u0644\u064A\u0629', 'Pharmacy'],
    };
    const pair = map[t];
    return pair ? tr(pair[0], pair[1]) : t;
  };

  const statusBadgeColor = (isActive: boolean) => {
    return isActive
      ? 'bg-[#6B8E23]/15 text-[#4A5D23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]'
      : 'bg-[#8B4513]/15 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#D4A017]';
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {tr('\u0627\u0644\u0645\u0633\u062A\u0648\u062F\u0639\u0627\u062A', 'Warehouses')}
        </h1>
        <Button onClick={() => setCreateOpen(true)}>
          {tr('\u0625\u0636\u0627\u0641\u0629 \u0645\u0633\u062A\u0648\u062F\u0639', 'Add Warehouse')}
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex flex-1 gap-2">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={tr('\u0628\u062D\u062B \u0628\u0627\u0644\u0627\u0633\u0645 \u0623\u0648 \u0627\u0644\u0631\u0645\u0632...', 'Search by name or code...')}
            className="flex-1"
          />
          <Button variant="secondary" onClick={handleSearch}>
            {tr('\u0628\u062D\u062B', 'Search')}
          </Button>
        </div>

        <Select
          value={facilityTypeFilter || '__all__'}
          onValueChange={(v) => setFacilityTypeFilter(v === '__all__' ? '' : v)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder={tr('\u0643\u0644 \u0627\u0644\u0623\u0646\u0648\u0627\u0639', 'All Types')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{tr('\u0643\u0644 \u0627\u0644\u0623\u0646\u0648\u0627\u0639', 'All Types')}</SelectItem>
            {FACILITY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{facilityTypeLabel(t)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={activeFilter || '__all__'}
          onValueChange={(v) => setActiveFilter(v === '__all__' ? '' : v)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder={tr('\u0643\u0644 \u0627\u0644\u062D\u0627\u0644\u0627\u062A', 'All Statuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{tr('\u0643\u0644 \u0627\u0644\u062D\u0627\u0644\u0627\u062A', 'All Statuses')}</SelectItem>
            <SelectItem value="true">{tr('\u0646\u0634\u0637', 'Active')}</SelectItem>
            <SelectItem value="false">{tr('\u063A\u064A\u0631 \u0646\u0634\u0637', 'Inactive')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {[
                tr('\u0627\u0644\u0631\u0645\u0632', 'Code'),
                tr('\u0627\u0644\u0627\u0633\u0645', 'Name'),
                tr('\u0627\u0644\u0646\u0648\u0639', 'Type'),
                tr('\u0627\u0644\u0645\u062F\u064A\u0646\u0629', 'City'),
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
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  {tr('\u062C\u0627\u0631\u064D \u0627\u0644\u062A\u062D\u0645\u064A\u0644...', 'Loading...')}
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  {tr('\u0644\u0627 \u062A\u0648\u062C\u062F \u0645\u0633\u062A\u0648\u062F\u0639\u0627\u062A', 'No warehouses found')}
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => handleRowClick(item)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">
                    {item.warehouseCode}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    {language === 'ar' && item.warehouseNameAr ? item.warehouseNameAr : item.warehouseName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {facilityTypeLabel(item.facilityType)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {item.city || '-'}
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              {tr('\u0627\u0644\u0633\u0627\u0628\u0642', 'Previous')}
            </Button>
            <span className="flex items-center px-3 text-sm text-gray-600 dark:text-gray-400">
              {tr(`\u0635\u0641\u062D\u0629 ${page} \u0645\u0646 ${totalPages}`, `Page ${page} of ${totalPages}`)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              {tr('\u0627\u0644\u062A\u0627\u0644\u064A', 'Next')}
            </Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <WarehouseFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={fetchData}
      />

      {/* Edit Dialog */}
      <WarehouseFormDialog
        mode="edit"
        warehouse={editWarehouse}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={fetchData}
      />

      {/* Detail Sheet */}
      <WarehouseDetailSheet
        warehouseId={detailWarehouseId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={handleEditFromSheet}
        onDeleted={fetchData}
      />
    </div>
  );
}
