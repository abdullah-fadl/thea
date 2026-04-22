'use client';

import { useLang } from '@/hooks/use-lang';
import { useEffect, useState, useCallback } from 'react';

const ADJUSTMENT_TYPES = ['ADD', 'SUBTRACT', 'SET'] as const;

export default function InventoryAdjustmentsPage() {
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
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ itemId: '', itemName: '', warehouseId: '', warehouseName: '', adjustmentType: 'ADD', quantity: 0, reason: '' });
  const [saving, setSaving] = useState(false);
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (typeFilter) params.set('adjustmentType', typeFilter);
      if (warehouseFilter) params.set('warehouseId', warehouseFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await fetch(`/api/imdad/inventory/adjustments?${params}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setData(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 0);
      }
    } catch (err) {
      console.error('Failed to fetch adjustments:', err);
    }
    setLoading(false);
  }, [page, search, typeFilter, warehouseFilter, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [search, typeFilter, warehouseFilter, dateFrom, dateTo]);

  const handleSearch = () => setSearch(searchInput);
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSearch(); };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/imdad/inventory/adjustments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(form) });
      if (res.ok) { setShowDialog(false); setForm({ itemId: '', itemName: '', warehouseId: '', warehouseName: '', adjustmentType: 'ADD', quantity: 0, reason: '' }); fetchData(); }
    } catch (err) { console.error('Create failed:', err); }
    setSaving(false);
  };

  const typeLabel = (t: string) => {
    const map: Record<string, [string, string]> = {
      ADD: ['إضافة', 'Add'], SUBTRACT: ['خصم', 'Subtract'], SET: ['تعيين', 'Set'],
    };
    const pair = map[t]; return pair ? tr(pair[0], pair[1]) : t;
  };

  const typeColor = (t: string) => {
    const map: Record<string, string> = {
      ADD: 'bg-[#6B8E23]/15 text-[#4A5D23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]',
      SUBTRACT: 'bg-[#8B4513]/15 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#D4A017]',
      SET: 'bg-[#D4A017]/15 text-[#C4960C] dark:bg-[#C4960C]/20 dark:text-[#E8A317]',
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{tr('تسويات المخزون', 'Inventory Adjustments')}</h1>
        <button onClick={() => { setShowDialog(true); setForm({ itemId: '', itemName: '', warehouseId: '', warehouseName: '', adjustmentType: 'ADD', quantity: 0, reason: '' }); }} className="rounded-lg bg-[#D4A017] px-4 py-2 text-sm font-medium text-white hover:bg-[#C4960C] transition-colors">
          {tr('إنشاء تسوية', 'Create Adjustment')}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="flex flex-1 gap-2 min-w-[250px]">
          <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={tr('بحث بالرقم أو الصنف...', 'Search by number or item...')}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017]" />
          <button onClick={handleSearch} className="rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            {tr('بحث', 'Search')}
          </button>
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none">
          <option value="">{tr('كل الأنواع', 'All Types')}</option>
          {ADJUSTMENT_TYPES.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
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
              {[tr('رقم التسوية', 'Adjustment No.'), tr('النوع', 'Type'), tr('الصنف', 'Item'), tr('المستودع', 'Warehouse'), tr('الكمية', 'Quantity'), tr('السبب', 'Reason'), tr('بواسطة', 'Adjusted By'), tr('التاريخ', 'Date')].map((col) => (
                <th key={col} className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">{tr('جارٍ التحميل...', 'Loading...')}</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">{tr('لا توجد تسويات', 'No adjustments found')}</td></tr>
            ) : data.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">{item.adjustmentNumber || item.id?.slice(-8)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${typeColor(item.adjustmentType)}`}>{typeLabel(item.adjustmentType)}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{item.itemName || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.warehouseName || '-'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                  {item.adjustmentType === 'SUBTRACT' ? `-${item.quantity}` : item.adjustmentType === 'ADD' ? `+${item.quantity}` : item.quantity}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-[200px] truncate">{item.reason || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.adjustedByName || item.adjustedBy || '-'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{fmtDate(item.createdAt)}</td>
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

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDialog(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{tr('إنشاء تسوية مخزون', 'Create Inventory Adjustment')}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{tr('الصنف', 'Item')}</label>
                <input value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} placeholder={tr('اسم الصنف', 'Item name')} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none" /></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{tr('المستودع', 'Warehouse')}</label>
                <input value={form.warehouseName} onChange={(e) => setForm({ ...form, warehouseName: e.target.value })} placeholder={tr('اسم المستودع', 'Warehouse name')} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none" /></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{tr('النوع', 'Type')}</label>
                <select value={form.adjustmentType} onChange={(e) => setForm({ ...form, adjustmentType: e.target.value })} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none">
                  {ADJUSTMENT_TYPES.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
                </select></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{tr('الكمية', 'Quantity')}</label>
                <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} min={0} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none" /></div>
              <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{tr('السبب', 'Reason')}</label>
                <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={2} placeholder={tr('سبب التسوية', 'Reason for adjustment')} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none" /></div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowDialog(false)} className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">{tr('إلغاء', 'Cancel')}</button>
              <button onClick={handleCreate} disabled={saving} className="rounded-lg bg-[#D4A017] px-4 py-2 text-sm font-medium text-white hover:bg-[#C4960C] disabled:opacity-50 transition-colors">{saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('حفظ', 'Save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
