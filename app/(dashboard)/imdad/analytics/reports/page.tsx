'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';

interface ReportDefinition {
  id: string;
  reportCode: string;
  reportName: string;
  reportCategory: string;
  supportedFormats: string[];
  isScheduled: boolean;
  isSystem: boolean;
  isActive: boolean;
  updatedAt: string;
}

const CATEGORY_OPTIONS = ['INVENTORY', 'PROCUREMENT', 'FINANCIAL', 'WAREHOUSE', 'QUALITY', 'ASSET'] as const;

export default function AnalyticsReportsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [data, setData] = useState<ReportDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [scheduledFilter, setScheduledFilter] = useState('');
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (categoryFilter) params.set('reportCategory', categoryFilter);
      if (scheduledFilter) params.set('isScheduled', scheduledFilter);
      const res = await fetch(`/api/imdad/analytics/reports?${params}`, { credentials: 'include' });
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
  }, [page, search, categoryFilter, scheduledFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const categoryBadge = (cat: string) => {
    const map: Record<string, { color: string; label: string }> = {
      INVENTORY: { color: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#C4960C]/20 dark:text-[#E8A317]', label: tr('المخزون', 'Inventory') },
      PROCUREMENT: { color: 'bg-[#6B8E23]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]', label: tr('المشتريات', 'Procurement') },
      FINANCIAL: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', label: tr('المالية', 'Financial') },
      WAREHOUSE: { color: 'bg-[#556B2F]/10 text-[#556B2F] dark:bg-[#4A5D23]/20 dark:text-[#9CB86B]', label: tr('المستودعات', 'Warehouse') },
      QUALITY: { color: 'bg-[#6B8E23]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]', label: tr('الجودة', 'Quality') },
      ASSET: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', label: tr('الأصول', 'Asset') },
    };
    const s = map[cat] || { color: 'bg-gray-100 text-gray-800', label: cat };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  const categoryFilterLabel = (cat: string) => {
    const map: Record<string, string> = {
      INVENTORY: tr('المخزون', 'Inventory'),
      PROCUREMENT: tr('المشتريات', 'Procurement'),
      FINANCIAL: tr('المالية', 'Financial'),
      WAREHOUSE: tr('المستودعات', 'Warehouse'),
      QUALITY: tr('الجودة', 'Quality'),
      ASSET: tr('الأصول', 'Asset'),
    };
    return map[cat] || cat;
  };

  const formatPill = (fmt: string) => {
    const map: Record<string, string> = {
      PDF: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#A0522D]',
      EXCEL: 'bg-[#6B8E23]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]',
      CSV: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#C4960C]/20 dark:text-[#E8A317]',
    };
    const color = map[fmt] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    return (
      <span key={fmt} className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
        {fmt}
      </span>
    );
  };

  const boolBadge = (val: boolean, trueLabel: string, falseLabel: string) => {
    return val
      ? <span className="px-2 py-1 rounded-full text-xs font-medium bg-[#6B8E23]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]">{trueLabel}</span>
      : <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">{falseLabel}</span>;
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US');
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4 md:space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {tr('تعريفات التقارير', 'Report Definitions')}
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
          value={categoryFilter}
          onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">{tr('جميع الفئات', 'All Categories')}</option>
          {CATEGORY_OPTIONS.map(c => (
            <option key={c} value={c}>{categoryFilterLabel(c)}</option>
          ))}
        </select>
        <select
          value={scheduledFilter}
          onChange={e => { setScheduledFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">{tr('الكل', 'All')}</option>
          <option value="true">{tr('مجدول', 'Scheduled')}</option>
          <option value="false">{tr('غير مجدول', 'Not Scheduled')}</option>
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
                  tr('رمز التقرير', 'Report Code'),
                  tr('اسم التقرير', 'Report Name'),
                  tr('الفئة', 'Category'),
                  tr('التنسيقات', 'Formats'),
                  tr('مجدول', 'Scheduled'),
                  tr('نظامي', 'System'),
                  tr('نشط', 'Active'),
                  tr('تاريخ التحديث', 'Updated At'),
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
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">{row.reportCode}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{row.reportName}</td>
                  <td className="px-4 py-3 text-sm">{categoryBadge(row.reportCategory)}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-1 flex-wrap">
                      {(row.supportedFormats || []).map(f => formatPill(f))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">{boolBadge(row.isScheduled, tr('نعم', 'Yes'), tr('لا', 'No'))}</td>
                  <td className="px-4 py-3 text-sm">{boolBadge(row.isSystem, tr('نعم', 'Yes'), tr('لا', 'No'))}</td>
                  <td className="px-4 py-3 text-sm">{boolBadge(row.isActive, tr('نشط', 'Active'), tr('غير نشط', 'Inactive'))}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(row.updatedAt)}</td>
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
