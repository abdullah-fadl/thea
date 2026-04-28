'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';

interface WardParLevel {
  id: string;
  departmentName: string;
  departmentId: string;
  itemCode: string;
  itemName: string;
  parLevel: number;
  maxLevel: number;
  reorderQty: number;
  avgDailyUsage: number;
  currentStock?: number;
  isActive: boolean;
}

export default function WardParLevelsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [data, setData] = useState<WardParLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [activeFilter, setActiveFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (activeFilter) params.set('isActive', activeFilter);
      if (departmentFilter) params.set('departmentId', departmentFilter);
      const res = await fetch(`/api/imdad/clinical/ward-par-levels?${params}`, { credentials: 'include' });
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
  }, [page, search, activeFilter, departmentFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stockIndicator = (row: WardParLevel) => {
    if (row.currentStock == null) return null;
    if (row.currentStock < row.parLevel) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#CD853F]">
          {tr('تحت الحد', 'Below Par')}
        </span>
      );
    }
    if (row.currentStock > row.maxLevel) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-[#E8A317]/10 text-[#E8A317] dark:bg-[#E8A317]/20 dark:text-[#E8A317]">
          {tr('فوق الحد الأقصى', 'Above Max')}
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]">
        {tr('طبيعي', 'Normal')}
      </span>
    );
  };

  const activeBadge = (isActive: boolean) => {
    return isActive
      ? <span className="px-2 py-1 rounded-full text-xs font-medium bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]">{tr('فعال', 'Active')}</span>
      : <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">{tr('غير فعال', 'Inactive')}</span>;
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4 md:space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {tr('مستويات التعبئة في الأجنحة', 'Ward PAR Levels')}
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
        <input
          type="text"
          placeholder={tr('معرف القسم...', 'Department ID...')}
          value={departmentFilter}
          onChange={e => { setDepartmentFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        />
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={activeFilter === 'true'}
            onChange={e => { setActiveFilter(e.target.checked ? 'true' : ''); setPage(1); }}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          {tr('الفعالة فقط', 'Active Only')}
        </label>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {tr('جارٍ التحميل...', 'Loading...')}
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {tr('لا توجد بيانات', 'No PAR level records found')}
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {[
                  tr('القسم', 'Department'),
                  tr('رمز الصنف', 'Item Code'),
                  tr('اسم الصنف', 'Item Name'),
                  tr('مستوى التعبئة', 'PAR Level'),
                  tr('الحد الأقصى', 'Max Level'),
                  tr('كمية إعادة الطلب', 'Reorder Qty'),
                  tr('المعدل اليومي', 'Avg Daily Usage'),
                  tr('الحالة', 'Status'),
                  tr('مستوى المخزون', 'Stock Level'),
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
                <tr
                  key={row.id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    row.currentStock != null && row.currentStock < row.parLevel
                      ? 'bg-[#8B4513]/5 dark:bg-[#8B4513]/10'
                      : ''
                  }`}
                >
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.departmentName || '—'}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{row.itemCode}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.itemName || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.parLevel}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.maxLevel}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.reorderQty}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.avgDailyUsage?.toFixed(1) ?? '—'}</td>
                  <td className="px-4 py-3 text-sm">{activeBadge(row.isActive)}</td>
                  <td className="px-4 py-3 text-sm">{stockIndicator(row)}</td>
                  <td className="px-4 py-3 text-sm">
                    <button className="text-[#D4A017] hover:text-[#C4960C] dark:text-[#E8A317] dark:hover:text-[#D4A017] text-sm">
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
