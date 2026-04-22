'use client';

import { useLang } from '@/hooks/use-lang';
import { useEffect, useState, useCallback } from 'react';

const PUT_AWAY_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const;

export default function PutAwayPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [detailLines, setDetailLines] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [form, setForm] = useState({ grnReference: '', warehouseId: '', warehouseName: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/imdad/warehouse/put-away?${params}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setData(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 0);
      }
    } catch (err) {
      console.error('Failed to fetch put-away orders:', err);
    }
    setLoading(false);
  }, [page, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const handleSearch = () => setSearch(searchInput);
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSearch(); };

  const openDetail = async (item: any) => {
    setDetailItem(item);
    setDetailLines([]);
    setShowDetailSheet(true);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/imdad/warehouse/put-away/${item.id}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setDetailLines(json.lines || json.data?.lines || []);
      }
    } catch (err) { console.error('Failed to fetch put-away details:', err); }
    setDetailLoading(false);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/imdad/warehouse/put-away', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(form) });
      if (res.ok) { setShowCreateDialog(false); setForm({ grnReference: '', warehouseId: '', warehouseName: '', notes: '' }); fetchData(); }
    } catch (err) { console.error('Create failed:', err); }
    setSaving(false);
  };

  const statusLabel = (s: string) => {
    const map: Record<string, [string, string]> = {
      PENDING: ['قيد الانتظار', 'Pending'], IN_PROGRESS: ['قيد التنفيذ', 'In Progress'], COMPLETED: ['مكتمل', 'Completed'],
    };
    const pair = map[s]; return pair ? tr(pair[0], pair[1]) : s;
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      PENDING: 'bg-[#E8A317]/15 text-[#C4960C] dark:bg-[#E8A317]/20 dark:text-[#E8A317]',
      IN_PROGRESS: 'bg-[#D4A017]/15 text-[#C4960C] dark:bg-[#C4960C]/20 dark:text-[#E8A317]',
      COMPLETED: 'bg-[#6B8E23]/15 text-[#4A5D23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]',
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{tr('أوامر التخزين', 'Put-Away Orders')}</h1>
        <button onClick={() => { setShowCreateDialog(true); setForm({ grnReference: '', warehouseId: '', warehouseName: '', notes: '' }); }} className="rounded-lg bg-[#D4A017] px-4 py-2 text-sm font-medium text-white hover:bg-[#C4960C] transition-colors">
          {tr('إنشاء أمر تخزين', 'Create Put-Away')}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex flex-1 gap-2">
          <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={tr('بحث برقم الأمر أو مرجع الاستلام...', 'Search by number or GRN ref...')}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017]" />
          <button onClick={handleSearch} className="rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            {tr('بحث', 'Search')}
          </button>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none">
          <option value="">{tr('كل الحالات', 'All Statuses')}</option>
          {PUT_AWAY_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {[tr('رقم أمر التخزين', 'Put-Away No.'), tr('مرجع الاستلام', 'GRN Reference'), tr('المستودع', 'Warehouse'), tr('الحالة', 'Status'), tr('تاريخ الإنشاء', 'Created Date'), tr('تاريخ الاكتمال', 'Completed Date'), tr('عدد البنود', 'Line Count'), tr('تفاصيل', 'Details')].map((col) => (
                <th key={col} className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">{tr('جارٍ التحميل...', 'Loading...')}</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">{tr('لا توجد أوامر تخزين', 'No put-away orders found')}</td></tr>
            ) : data.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">{item.putAwayNumber || item.id?.slice(-8)}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.grnReference || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.warehouseName || '-'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(item.status)}`}>{statusLabel(item.status)}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{fmtDate(item.createdAt)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{fmtDate(item.completedAt)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.lineCount ?? item.lines?.length ?? 0}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  <button onClick={() => openDetail(item)} className="text-[#D4A017] hover:text-[#C4960C] dark:text-[#E8A317] dark:hover:text-[#E8A317] text-xs font-medium">{tr('عرض', 'View')}</button>
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

      {/* Create Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreateDialog(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{tr('إنشاء أمر تخزين', 'Create Put-Away Order')}</h2>
            <div className="space-y-4">
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{tr('مرجع إذن الاستلام (GRN)', 'GRN Reference')}</label>
                <input value={form.grnReference} onChange={(e) => setForm({ ...form, grnReference: e.target.value })} placeholder={tr('أدخل رقم إذن الاستلام', 'Enter GRN number')} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none" /></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{tr('ملاحظات', 'Notes')}</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#D4A017] focus:outline-none" /></div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowCreateDialog(false)} className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">{tr('إلغاء', 'Cancel')}</button>
              <button onClick={handleCreate} disabled={saving} className="rounded-lg bg-[#D4A017] px-4 py-2 text-sm font-medium text-white hover:bg-[#C4960C] disabled:opacity-50 transition-colors">{saving ? tr('جارٍ الإنشاء...', 'Creating...') : tr('إنشاء', 'Create')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Sheet */}
      {showDetailSheet && detailItem && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setShowDetailSheet(false)}>
          <div className="bg-white dark:bg-gray-900 shadow-xl w-full max-w-xl h-full overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{tr('تفاصيل أمر التخزين', 'Put-Away Details')}</h2>
              <button onClick={() => setShowDetailSheet(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl">&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500 dark:text-gray-400">{tr('الرقم', 'Number')}</span><p className="font-mono text-gray-900 dark:text-white">{detailItem.putAwayNumber || detailItem.id?.slice(-8)}</p></div>
              <div><span className="text-gray-500 dark:text-gray-400">{tr('مرجع الاستلام', 'GRN Ref')}</span><p className="text-gray-900 dark:text-white">{detailItem.grnReference || '-'}</p></div>
              <div><span className="text-gray-500 dark:text-gray-400">{tr('المستودع', 'Warehouse')}</span><p className="text-gray-900 dark:text-white">{detailItem.warehouseName || '-'}</p></div>
              <div><span className="text-gray-500 dark:text-gray-400">{tr('الحالة', 'Status')}</span><p><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(detailItem.status)}`}>{statusLabel(detailItem.status)}</span></p></div>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white pt-2">{tr('بنود التخزين', 'Put-Away Lines')}</h3>
            {detailLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{tr('جارٍ التحميل...', 'Loading...')}</p>
            ) : detailLines.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{tr('لا توجد بنود', 'No lines found')}</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      {[tr('الصنف', 'Item'), tr('الكمية', 'Quantity'), tr('الصندوق الوجهة', 'Destination Bin')].map((col) => (
                        <th key={col} className="px-3 py-2 text-start text-xs font-medium uppercase text-gray-500 dark:text-gray-400">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                    {detailLines.map((line: any, idx: number) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 text-gray-900 dark:text-white">{line.itemName || '-'}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{line.quantity ?? 0}</td>
                        <td className="px-3 py-2 font-mono text-gray-600 dark:text-gray-300">{line.destinationBinCode || line.destinationBin || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
