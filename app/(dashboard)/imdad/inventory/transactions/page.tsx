'use client';

import { useLang } from '@/hooks/use-lang';
import { useEffect, useState, useCallback } from 'react';

const TRANSACTION_TYPES = ['RECEIPT', 'ISSUE', 'TRANSFER', 'ADJUSTMENT', 'RETURN'] as const;

export default function InventoryTransactionsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (typeFilter) params.set('transactionType', typeFilter);
      if (warehouseFilter) params.set('warehouseId', warehouseFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await fetch(`/api/imdad/inventory/transactions?${params}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setData(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 0);
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    }
    setLoading(false);
  }, [page, search, typeFilter, warehouseFilter, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [search, typeFilter, warehouseFilter, dateFrom, dateTo]);

  const handleSearch = () => setSearch(searchInput);
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSearch(); };

  const typeLabel = (t: string) => {
    const map: Record<string, [string, string]> = {
      RECEIPT: ['استلام', 'Receipt'], ISSUE: ['صرف', 'Issue'], TRANSFER: ['تحويل', 'Transfer'],
      ADJUSTMENT: ['تسوية', 'Adjustment'], RETURN: ['إرجاع', 'Return'],
    };
    const pair = map[t]; return pair ? tr(pair[0], pair[1]) : t;
  };

  const typeColor = (t: string) => {
    const map: Record<string, string> = {
      RECEIPT: 'bg-[#6B8E23]/15 text-[#4A5D23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]',
      ISSUE: 'bg-[#E8A317]/15 text-[#C4960C] dark:bg-[#E8A317]/20 dark:text-[#E8A317]',
      TRANSFER: 'bg-[#D4A017]/15 text-[#C4960C] dark:bg-[#C4960C]/20 dark:text-[#E8A317]',
      ADJUSTMENT: 'bg-[#556B2F]/15 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]',
      RETURN: 'bg-[#E8A317]/15 text-[#C4960C] dark:bg-[#E8A317]/20 dark:text-[#E8A317]',
    };
    return map[t] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  };

  const fmtDate = (d: string | null) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return d; }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{tr('سجل حركات المخزون', 'Inventory Transaction Log')}</h1>
        <div className="rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">
          {tr('عرض فقط - سجل تلقائي', 'Read-only - Auto-generated ledger')}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="flex flex-1 gap-2 min-w-[250px]">
          <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={tr('بحث بالصنف أو المرجع...', 'Search by item or reference...')}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017]" />
          <button onClick={handleSearch} className="rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            {tr('بحث', 'Search')}
          </button>
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none">
          <option value="">{tr('كل الأنواع', 'All Types')}</option>
          {TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
        </select>
        <div className="flex gap-2 items-center">
          <label className="text-xs text-gray-500 dark:text-gray-400">{tr('من', 'From')}</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none" />
          <label className="text-xs text-gray-500 dark:text-gray-400">{tr('إلى', 'To')}</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {[tr('نوع الحركة', 'Transaction Type'), tr('الصنف', 'Item'), tr('الكمية', 'Quantity'), tr('من الموقع', 'From Location'), tr('إلى الموقع', 'To Location'), tr('المستند المرجعي', 'Reference Doc'), tr('التاريخ', 'Timestamp'), tr('المستخدم', 'User')].map((col) => (
                <th key={col} className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">{tr('جارٍ التحميل...', 'Loading...')}</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">{tr('لا توجد حركات', 'No transactions found')}</td></tr>
            ) : data.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${typeColor(item.transactionType)}`}>{typeLabel(item.transactionType)}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{item.itemName || '-'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{item.quantity ?? 0}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.fromLocationName || item.fromLocation || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.toLocationName || item.toLocation || '-'}</td>
                <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-300 max-w-[150px] truncate">{item.referenceDoc || item.referenceNumber || '-'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{fmtDate(item.createdAt || item.timestamp)}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.userName || item.userId || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">{tr(`عرض ${(page - 1) * limit + 1} - ${Math.min(page * limit, total)} من ${total}`, `Showing ${(page - 1) * limit + 1} - ${Math.min(page * limit, total)} of ${total}`)}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{tr('السابق', 'Previous')}</button>
            <span className="flex items-center px-3 text-sm text-gray-600 dark:text-gray-400">{tr(`صفحة ${page} من ${totalPages}`, `Page ${page} of ${totalPages}`)}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{tr('التالي', 'Next')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
