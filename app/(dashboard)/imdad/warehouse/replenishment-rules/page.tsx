'use client';

import { useLang } from '@/hooks/use-lang';
import { useEffect, useState, useCallback } from 'react';

const RULE_STATUSES = ['ACTIVE', 'INACTIVE', 'PAUSED'] as const;

export default function ReplenishmentRulesPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ itemName: '', itemId: '', sourceWarehouseId: '', sourceWarehouseName: '', destinationWarehouseId: '', destinationWarehouseName: '', minLevel: 0, maxLevel: 100, reorderQty: 50, status: 'ACTIVE' });
  const [saving, setSaving] = useState(false);
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (warehouseFilter) params.set('warehouseId', warehouseFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/imdad/warehouse/replenishment-rules?${params}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setData(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 0);
      }
    } catch (err) {
      console.error('Failed to fetch replenishment rules:', err);
    }
    setLoading(false);
  }, [page, search, warehouseFilter, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [search, warehouseFilter, statusFilter]);

  const handleSearch = () => setSearch(searchInput);
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSearch(); };

  const openCreate = () => {
    setEditItem(null);
    setForm({ itemName: '', itemId: '', sourceWarehouseId: '', sourceWarehouseName: '', destinationWarehouseId: '', destinationWarehouseName: '', minLevel: 0, maxLevel: 100, reorderQty: 50, status: 'ACTIVE' });
    setShowDialog(true);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setForm({ itemName: item.itemName || '', itemId: item.itemId || '', sourceWarehouseId: item.sourceWarehouseId || '', sourceWarehouseName: item.sourceWarehouseName || '', destinationWarehouseId: item.destinationWarehouseId || '', destinationWarehouseName: item.destinationWarehouseName || '', minLevel: item.minLevel ?? 0, maxLevel: item.maxLevel ?? 100, reorderQty: item.reorderQty ?? 50, status: item.status || 'ACTIVE' });
    setShowDialog(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editItem ? `/api/imdad/warehouse/replenishment-rules/${editItem.id}` : '/api/imdad/warehouse/replenishment-rules';
      const method = editItem ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(form) });
      if (res.ok) { setShowDialog(false); fetchData(); }
    } catch (err) { console.error('Save failed:', err); }
    setSaving(false);
  };

  const statusLabel = (s: string) => {
    const map: Record<string, [string, string]> = {
      ACTIVE: ['نشط', 'Active'], INACTIVE: ['غير نشط', 'Inactive'], PAUSED: ['متوقف', 'Paused'],
    };
    const pair = map[s]; return pair ? tr(pair[0], pair[1]) : s;
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      ACTIVE: 'bg-[#6B8E23]/15 text-[#4A5D23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]',
      INACTIVE: 'bg-[#8B4513]/15 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#D4A017]',
      PAUSED: 'bg-[#E8A317]/15 text-[#C4960C] dark:bg-[#E8A317]/20 dark:text-[#E8A317]',
    };
    return map[s] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  };

  const fmtDate = (d: string | null) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return d; }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{tr('قواعد التجديد', 'Replenishment Rules')}</h1>
        <button onClick={openCreate} className="rounded-lg bg-[#D4A017] px-4 py-2 text-sm font-medium text-white hover:bg-[#C4960C] transition-colors">
          {tr('إضافة قاعدة', 'Add Rule')}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex flex-1 gap-2">
          <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={tr('بحث بالصنف...', 'Search by item...')}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017]" />
          <button onClick={handleSearch} className="rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            {tr('بحث', 'Search')}
          </button>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none">
          <option value="">{tr('كل الحالات', 'All Statuses')}</option>
          {RULE_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {[tr('الصنف', 'Item'), tr('مستودع المصدر', 'Source Warehouse'), tr('الوجهة', 'Destination'), tr('الحد الأدنى', 'Min Level'), tr('الحد الأقصى', 'Max Level'), tr('كمية الطلب', 'Reorder Qty'), tr('الحالة', 'Status'), tr('آخر تفعيل', 'Last Triggered'), tr('إجراءات', 'Actions')].map((col) => (
                <th key={col} className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">{tr('جارٍ التحميل...', 'Loading...')}</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">{tr('لا توجد قواعد', 'No rules found')}</td></tr>
            ) : data.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{item.itemName || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.sourceWarehouseName || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.destinationWarehouseName || '-'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.minLevel ?? 0}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.maxLevel ?? 0}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.reorderQty ?? 0}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(item.status)}`}>{statusLabel(item.status)}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{fmtDate(item.lastTriggeredAt)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  <button onClick={() => openEdit(item)} className="text-[#D4A017] hover:text-[#C4960C] dark:text-[#E8A317] dark:hover:text-[#E8A317] text-xs font-medium">{tr('تعديل', 'Edit')}</button>
                </td>
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editItem ? tr('تعديل قاعدة', 'Edit Rule') : tr('إضافة قاعدة', 'Add Rule')}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{tr('الصنف', 'Item')}</label>
                <input value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none" /></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{tr('الحد الأدنى', 'Min Level')}</label>
                <input type="number" value={form.minLevel} onChange={(e) => setForm({ ...form, minLevel: Number(e.target.value) })} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none" /></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{tr('الحد الأقصى', 'Max Level')}</label>
                <input type="number" value={form.maxLevel} onChange={(e) => setForm({ ...form, maxLevel: Number(e.target.value) })} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none" /></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{tr('كمية الطلب', 'Reorder Qty')}</label>
                <input type="number" value={form.reorderQty} onChange={(e) => setForm({ ...form, reorderQty: Number(e.target.value) })} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none" /></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{tr('الحالة', 'Status')}</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none">
                  {RULE_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                </select></div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowDialog(false)} className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">{tr('إلغاء', 'Cancel')}</button>
              <button onClick={handleSave} disabled={saving} className="rounded-lg bg-[#D4A017] px-4 py-2 text-sm font-medium text-white hover:bg-[#C4960C] disabled:opacity-50 transition-colors">{saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('حفظ', 'Save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
