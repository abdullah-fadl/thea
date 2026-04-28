'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';

interface AssetDisposal {
  id: string;
  disposalNumber: string;
  assetTag: string;
  assetName: string;
  disposalMethod: string;
  disposalDate: string;
  bookValueAtDisposal: number;
  proceedsAmount: number;
  gainLoss: number;
}

const METHOD_OPTIONS = ['SOLD', 'DONATED', 'SCRAPPED', 'RETURNED_VENDOR', 'TRADED_IN', 'RECYCLED'] as const;

export default function AssetDisposalsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [data, setData] = useState<AssetDisposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [methodFilter, setMethodFilter] = useState('');
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (methodFilter) params.set('disposalMethod', methodFilter);
      const res = await fetch(`/api/imdad/assets/disposals?${params}`, { credentials: 'include' });
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
  }, [page, search, methodFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const methodBadge = (method: string) => {
    const map: Record<string, { color: string; label: string }> = {
      SOLD: { color: 'bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]', label: tr('مباع', 'Sold') },
      DONATED: { color: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#C4960C]/20 dark:text-[#E8A317]', label: tr('تبرع', 'Donated') },
      SCRAPPED: { color: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#D2691E]', label: tr('خردة', 'Scrapped') },
      RETURNED_VENDOR: { color: 'bg-[#556B2F]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]', label: tr('مرتجع للمورد', 'Returned to Vendor') },
      TRADED_IN: { color: 'bg-[#D4A017]/15 text-[#C4960C] dark:bg-[#C4960C]/20 dark:text-[#E8A317]', label: tr('مقايضة', 'Traded In') },
      RECYCLED: { color: 'bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]', label: tr('معاد تدوير', 'Recycled') },
    };
    const m = map[method] || { color: 'bg-gray-100 text-gray-800', label: method };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${m.color}`}>{m.label}</span>;
  };

  const methodFilterLabel = (m: string) => {
    const map: Record<string, string> = {
      SOLD: tr('مباع', 'Sold'),
      DONATED: tr('تبرع', 'Donated'),
      SCRAPPED: tr('خردة', 'Scrapped'),
      RETURNED_VENDOR: tr('مرتجع للمورد', 'Returned to Vendor'),
      TRADED_IN: tr('مقايضة', 'Traded In'),
      RECYCLED: tr('معاد تدوير', 'Recycled'),
    };
    return map[m] || m;
  };

  const formatCurrency = (val: number | undefined | null) => {
    if (val == null) return '—';
    return new Intl.NumberFormat(language === 'ar' ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' }).format(val);
  };

  const formatGainLoss = (val: number | undefined | null) => {
    if (val == null) return '—';
    const formatted = new Intl.NumberFormat(language === 'ar' ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' }).format(Math.abs(val));
    if (val > 0) {
      return <span className="text-[#6B8E23] dark:text-[#9CB86B] font-medium">+{formatted}</span>;
    } else if (val < 0) {
      return <span className="text-[#8B4513] dark:text-[#D2691E] font-medium">-{formatted}</span>;
    }
    return <span className="text-gray-600 dark:text-gray-400">{formatted}</span>;
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US');
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4 md:space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {tr('التخلص من الأصول', 'Asset Disposals')}
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
          value={methodFilter}
          onChange={e => { setMethodFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">{tr('جميع طرق التخلص', 'All Disposal Methods')}</option>
          {METHOD_OPTIONS.map(m => (
            <option key={m} value={m}>{methodFilterLabel(m)}</option>
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
          {tr('لا توجد عمليات تخلص', 'No disposals found')}
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {[
                  tr('رقم التخلص', 'Disposal #'),
                  tr('رمز الأصل', 'Asset Tag'),
                  tr('اسم الأصل', 'Asset Name'),
                  tr('طريقة التخلص', 'Disposal Method'),
                  tr('تاريخ التخلص', 'Disposal Date'),
                  tr('القيمة الدفترية', 'Book Value'),
                  tr('المتحصلات', 'Proceeds'),
                  tr('الربح/الخسارة', 'Gain/Loss'),
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
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{row.disposalNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.assetTag || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.assetName || '—'}</td>
                  <td className="px-4 py-3 text-sm">{methodBadge(row.disposalMethod)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(row.disposalDate)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatCurrency(row.bookValueAtDisposal)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatCurrency(row.proceedsAmount)}</td>
                  <td className="px-4 py-3 text-sm">{formatGainLoss(row.gainLoss)}</td>
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
