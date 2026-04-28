'use client';

import { useLang } from '@/hooks/use-lang';
import { useEffect, useState, useCallback } from 'react';

const BIN_TYPES = ['SHELF', 'PALLET', 'FLOOR', 'RACK', 'DRAWER', 'COLD', 'BULK'] as const;
const STATUSES = ['ACTIVE', 'INACTIVE', 'FULL', 'MAINTENANCE'] as const;

export default function BinsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ binCode: '', zoneName: '', zoneId: '', warehouseId: '', warehouseName: '', binType: 'SHELF', capacity: 100, currentOccupancy: 0, status: 'ACTIVE' });
  const [saving, setSaving] = useState(false);
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (zoneFilter) params.set('zoneId', zoneFilter);
      if (warehouseFilter) params.set('warehouseId', warehouseFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/imdad/warehouse/bins?${params}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setData(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 0);
      }
    } catch (err) {
      console.error('Failed to fetch bins:', err);
    }
    setLoading(false);
  }, [page, search, zoneFilter, warehouseFilter, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [search, zoneFilter, warehouseFilter, statusFilter]);

  const handleSearch = () => setSearch(searchInput);
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSearch(); };

  const openCreate = () => {
    setEditItem(null);
    setForm({ binCode: '', zoneName: '', zoneId: '', warehouseId: '', warehouseName: '', binType: 'SHELF', capacity: 100, currentOccupancy: 0, status: 'ACTIVE' });
    setShowDialog(true);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setForm({ binCode: item.binCode || '', zoneName: item.zoneName || '', zoneId: item.zoneId || '', warehouseId: item.warehouseId || '', warehouseName: item.warehouseName || '', binType: item.binType || 'SHELF', capacity: item.capacity ?? 100, currentOccupancy: item.currentOccupancy ?? 0, status: item.status || 'ACTIVE' });
    setShowDialog(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editItem ? `/api/imdad/warehouse/bins/${editItem.id}` : '/api/imdad/warehouse/bins';
      const method = editItem ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(form) });
      if (res.ok) { setShowDialog(false); fetchData(); }
    } catch (err) { console.error('Save failed:', err); }
    setSaving(false);
  };

  const binTypeLabel = (t: string) => {
    const map: Record<string, [string, string]> = {
      SHELF: ['رف', 'Shelf'], PALLET: ['طبلية', 'Pallet'], FLOOR: ['أرضي', 'Floor'],
      RACK: ['حامل', 'Rack'], DRAWER: ['درج', 'Drawer'], COLD: ['مبرد', 'Cold'], BULK: ['كمية', 'Bulk'],
    };
    const pair = map[t]; return pair ? tr(pair[0], pair[1]) : t;
  };

  const statusLabel = (s: string) => {
    const map: Record<string, [string, string]> = {
      ACTIVE: ['نشط', 'Active'], INACTIVE: ['غير نشط', 'Inactive'], FULL: ['ممتلئ', 'Full'], MAINTENANCE: ['صيانة', 'Maintenance'],
    };
    const pair = map[s]; return pair ? tr(pair[0], pair[1]) : s;
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      ACTIVE: 'bg-[#6B8E23]/15 text-[#4A5D23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]',
      INACTIVE: 'bg-[#8B4513]/15 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#D4A017]',
      FULL: 'bg-[#E8A317]/15 text-[#C4960C] dark:bg-[#E8A317]/20 dark:text-[#E8A317]',
      MAINTENANCE: 'bg-[#E8A317]/15 text-[#C4960C] dark:bg-[#E8A317]/20 dark:text-[#E8A317]',
    };
    return map[s] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  };

  const occupancyPct = (item: any) => {
    if (!item.capacity || item.capacity === 0) return 0;
    return Math.min(100, Math.round((item.currentOccupancy / item.capacity) * 100));
  };

  const occupancyColor = (pct: number) => pct >= 90 ? 'bg-[#8B4513]' : pct >= 70 ? 'bg-[#E8A317]' : 'bg-[#6B8E23]';

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{tr('الصناديق', 'Bins')}</h1>
        <button onClick={openCreate} className="rounded-lg bg-[#D4A017] px-4 py-2 text-sm font-medium text-white hover:bg-[#C4960C] transition-colors">
          {tr('إضافة صندوق', 'Add Bin')}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex flex-1 gap-2">
          <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={tr('بحث بالرمز...', 'Search by code...')}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017]" />
          <button onClick={handleSearch} className="rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            {tr('بحث', 'Search')}
          </button>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none">
          <option value="">{tr('كل الحالات', 'All Statuses')}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {[tr('رمز الصندوق', 'Bin Code'), tr('المنطقة', 'Zone'), tr('المستودع', 'Warehouse'), tr('النوع', 'Bin Type'), tr('السعة', 'Capacity'), tr('الإشغال', 'Occupancy'), tr('الحالة', 'Status'), tr('إجراءات', 'Actions')].map((col) => (
                <th key={col} className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">{tr('جارٍ التحميل...', 'Loading...')}</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">{tr('لا توجد صناديق', 'No bins found')}</td></tr>
            ) : data.map((item) => {
              const pct = occupancyPct(item);
              return (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">{item.binCode}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.zoneName || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.warehouseName || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{binTypeLabel(item.binType)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.capacity ?? 0}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div className={`h-full rounded-full ${occupancyColor(pct)}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-600 dark:text-gray-400">{pct}%</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(item.status)}`}>{statusLabel(item.status)}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <button onClick={() => openEdit(item)} className="text-[#D4A017] hover:text-[#C4960C] dark:text-[#E8A317] dark:hover:text-[#E8A317] text-xs font-medium">{tr('تعديل', 'Edit')}</button>
                  </td>
                </tr>
              );
            })}
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editItem ? tr('تعديل صندوق', 'Edit Bin') : tr('إضافة صندوق', 'Add Bin')}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{tr('رمز الصندوق', 'Bin Code')}</label>
                <input value={form.binCode} onChange={(e) => setForm({ ...form, binCode: e.target.value })} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none" /></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{tr('النوع', 'Bin Type')}</label>
                <select value={form.binType} onChange={(e) => setForm({ ...form, binType: e.target.value })} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none">
                  {BIN_TYPES.map((t) => <option key={t} value={t}>{binTypeLabel(t)}</option>)}
                </select></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{tr('السعة', 'Capacity')}</label>
                <input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none" /></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{tr('الحالة', 'Status')}</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none">
                  {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
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
