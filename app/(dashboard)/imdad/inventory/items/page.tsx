'use client';

import { useLang } from '@/hooks/use-lang';
import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ItemFormDialog } from '@/components/imdad/inventory/ItemFormDialog';
import { ItemDetailSheet } from '@/components/imdad/inventory/ItemDetailSheet';

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'DISCONTINUED', 'PENDING_APPROVAL'] as const;
const TYPE_OPTIONS = ['PHARMACEUTICAL', 'MEDICAL_SUPPLY', 'EQUIPMENT', 'CONSUMABLE', 'REAGENT', 'IMPLANT', 'OTHER'] as const;

export default function ItemsMasterPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const limit = 20;

  // Dialog / Sheet state
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('itemType', typeFilter);
      const res = await fetch(`/api/imdad/inventory/items?${params}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setItems(json.items || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 0);
      }
    } catch (err) {
      console.error('Failed to fetch items:', err);
    }
    setLoading(false);
  }, [page, search, statusFilter, typeFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, typeFilter]);

  const handleSearch = () => {
    setSearch(searchInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleRowClick = (item: any) => {
    setSelectedItem(item);
    setDetailOpen(true);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatusFilter('');
    setTypeFilter('');
  };

  const hasActiveFilters = search || statusFilter || typeFilter;

  const statusLabel = (s: string) => {
    const map: Record<string, [string, string]> = {
      ACTIVE: ['نشط', 'Active'],
      INACTIVE: ['غير نشط', 'Inactive'],
      DISCONTINUED: ['متوقف', 'Discontinued'],
      PENDING_APPROVAL: ['بانتظار الموافقة', 'Pending Approval'],
    };
    const pair = map[s];
    return pair ? tr(pair[0], pair[1]) : s;
  };

  const typeLabel = (t: string) => {
    const map: Record<string, [string, string]> = {
      PHARMACEUTICAL: ['أدوية', 'Pharmaceutical'],
      MEDICAL_SUPPLY: ['مستلزمات طبية', 'Medical Supply'],
      EQUIPMENT: ['أجهزة', 'Equipment'],
      CONSUMABLE: ['مواد استهلاكية', 'Consumable'],
      REAGENT: ['كواشف', 'Reagent'],
      IMPLANT: ['زراعات', 'Implant'],
      OTHER: ['أخرى', 'Other'],
    };
    const pair = map[t];
    return pair ? tr(pair[0], pair[1]) : t;
  };

  const statusBadgeColor = (s: string) => {
    switch (s) {
      case 'ACTIVE': return 'bg-[#6B8E23]/15 text-[#4A5D23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]';
      case 'INACTIVE': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'DISCONTINUED': return 'bg-[#8B4513]/15 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#D4A017]';
      case 'PENDING_APPROVAL': return 'bg-[#E8A317]/15 text-[#C4960C] dark:bg-[#E8A317]/20 dark:text-[#E8A317]';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {tr('سجل الأصناف', 'Items Master')}
        </h1>
        <Button onClick={() => setCreateOpen(true)}>
          {tr('إضافة صنف', 'Add Item')}
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex flex-1 gap-2">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={tr('بحث بالاسم أو الرمز...', 'Search by name or code...')}
            className="flex-1"
          />
          <Button variant="secondary" onClick={handleSearch}>
            {tr('بحث', 'Search')}
          </Button>
        </div>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder={tr('كل الحالات', 'All Statuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{tr('كل الحالات', 'All Statuses')}</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder={tr('كل الأنواع', 'All Types')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{tr('كل الأنواع', 'All Types')}</SelectItem>
            {TYPE_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" onClick={handleClearFilters} className="text-sm">
            {tr('مسح الفلاتر', 'Clear Filters')}
          </Button>
        )}
      </div>

      {/* Results count */}
      {!loading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr(`${total} صنف`, `${total} items`)}
        </p>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {[
                tr('الرمز', 'Code'),
                tr('الاسم', 'Name'),
                tr('النوع', 'Type'),
                tr('الفئة', 'Category'),
                tr('الحالة', 'Status'),
                tr('تكلفة الوحدة', 'Unit Cost'),
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
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  {tr('جارٍ التحميل...', 'Loading...')}
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  {tr('لا توجد أصناف', 'No items found')}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => handleRowClick(item)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">
                    {item.code}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    {language === 'ar' && item.nameAr ? item.nameAr : item.name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {typeLabel(item.itemType)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {item.category || '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeColor(item.status)}`}>
                      {statusLabel(item.status)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {item.standardCost != null ? Number(item.standardCost).toFixed(2) : '-'}
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
              `عرض ${(page - 1) * limit + 1} - ${Math.min(page * limit, total)} من ${total}`,
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
              {tr('السابق', 'Previous')}
            </Button>
            <span className="flex items-center px-3 text-sm text-gray-600 dark:text-gray-400">
              {tr(`صفحة ${page} من ${totalPages}`, `Page ${page} of ${totalPages}`)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              {tr('التالي', 'Next')}
            </Button>
          </div>
        </div>
      )}

      {/* Create Item Dialog */}
      <ItemFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={fetchItems}
      />

      {/* Item Detail Sheet */}
      <ItemDetailSheet
        item={selectedItem}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdated={fetchItems}
      />
    </div>
  );
}
