'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';

interface ConsumptionLog {
  id: string;
  itemCode: string;
  itemName: string;
  departmentId: string;
  departmentName?: string;
  quantity: number;
  consumptionType: string;
  consumedAt: string;
  totalCost?: number;
}

const TYPE_OPTIONS = ['PATIENT_USE', 'PROCEDURE', 'WASTE', 'EXPIRED', 'BROKEN'] as const;

export default function ConsumptionPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [data, setData] = useState<ConsumptionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (typeFilter) params.set('consumptionType', typeFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await fetch(`/api/imdad/clinical/consumption?${params}`, { credentials: 'include' });
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
  }, [page, search, typeFilter, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const typeBadge = (type: string) => {
    const map: Record<string, { color: string; label: string }> = {
      PATIENT_USE: { color: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#D4A017]/20 dark:text-[#E8A317]', label: tr('استخدام مريض', 'Patient Use') },
      PROCEDURE: { color: 'bg-[#556B2F]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]', label: tr('إجراء', 'Procedure') },
      WASTE: { color: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#CD853F]', label: tr('هدر', 'Waste') },
      EXPIRED: { color: 'bg-[#E8A317]/10 text-[#C4960C] dark:bg-[#E8A317]/20 dark:text-[#E8A317]', label: tr('منتهي الصلاحية', 'Expired') },
      BROKEN: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', label: tr('مكسور', 'Broken') },
    };
    const s = map[type] || { color: 'bg-gray-100 text-gray-800', label: type };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  const typeFilterLabel = (t: string) => {
    const map: Record<string, string> = {
      PATIENT_USE: tr('استخدام مريض', 'Patient Use'),
      PROCEDURE: tr('إجراء', 'Procedure'),
      WASTE: tr('هدر', 'Waste'),
      EXPIRED: tr('منتهي الصلاحية', 'Expired'),
      BROKEN: tr('مكسور', 'Broken'),
    };
    return map[t] || t;
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US');
  };

  const formatAmount = (amount: number) => {
    if (amount == null) return '—';
    return new Intl.NumberFormat(language === 'ar' ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4 md:space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {tr('سجل الاستهلاك', 'Consumption Log')}
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
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">{tr('جميع الأنواع', 'All Types')}</option>
          {TYPE_OPTIONS.map(t => (
            <option key={t} value={t}>{typeFilterLabel(t)}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">{tr('من', 'From')}</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">{tr('إلى', 'To')}</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(1); }}
            className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {tr('جارٍ التحميل...', 'Loading...')}
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {tr('لا توجد سجلات استهلاك', 'No consumption records found')}
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {[
                  tr('رمز الصنف', 'Item Code'),
                  tr('اسم الصنف', 'Item Name'),
                  tr('القسم', 'Department'),
                  tr('الكمية', 'Quantity'),
                  tr('نوع الاستهلاك', 'Type'),
                  tr('تاريخ الاستهلاك', 'Consumed At'),
                  tr('التكلفة الإجمالية', 'Total Cost'),
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
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{row.itemCode}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.itemName || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.departmentName || row.departmentId?.slice(0, 8) || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.quantity}</td>
                  <td className="px-4 py-3 text-sm">{typeBadge(row.consumptionType)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(row.consumedAt)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatAmount(row.totalCost)}</td>
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
