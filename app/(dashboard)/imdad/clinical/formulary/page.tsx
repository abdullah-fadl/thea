'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { FormularyFormDialog } from '@/components/imdad/clinical/FormularyFormDialog';
import { FormularyDetailSheet } from '@/components/imdad/clinical/FormularyDetailSheet';

interface FormularyItem {
  id: string;
  itemCode: string;
  itemName: string;
  genericName: string;
  genericNameAr: string;
  formularyStatus: string;
  therapeuticClass: string;
  formularyCategory: string;
  isControlled: boolean;
  insuranceCovered?: boolean;
  requiresApproval?: boolean;
  approvalLevel?: string;
  maxDailyDose?: string;
  maxOrderQty?: string;
  unitPrice?: string;
  indications?: string;
  contraindications?: string;
  sideEffects?: string;
  interactions?: string;
  storageInstructions?: string;
  committeeApproval?: boolean;
  version?: number;
  createdAt?: string;
  lastReviewDate?: string;
  nextReviewDate?: string;
  itemId?: string;
  organizationId?: string;
}

const STATUS_OPTIONS = ['ACTIVE', 'RESTRICTED', 'NON_FORMULARY', 'DISCONTINUED', 'PENDING_REVIEW'] as const;

export default function FormularyPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [data, setData] = useState<FormularyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [controlledFilter, setControlledFilter] = useState('');
  const limit = 20;

  // Dialog / Sheet state
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FormularyItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (statusFilter) params.set('formularyStatus', statusFilter);
      if (controlledFilter) params.set('isControlled', controlledFilter);
      const res = await fetch(`/api/imdad/clinical/formulary?${params}`, { credentials: 'include' });
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
  }, [page, search, statusFilter, controlledFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRowClick = async (row: FormularyItem) => {
    // Fetch full detail for the item
    try {
      const res = await fetch(`/api/imdad/clinical/formulary/${row.id}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setSelectedItem(json.data || row);
      } else {
        setSelectedItem(row);
      }
    } catch {
      setSelectedItem(row);
    }
    setDetailOpen(true);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { color: string; label: string }> = {
      ACTIVE: { color: 'bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]', label: tr('فعال', 'Active') },
      RESTRICTED: { color: 'bg-[#E8A317]/10 text-[#E8A317] dark:bg-[#E8A317]/20 dark:text-[#E8A317]', label: tr('مقيد', 'Restricted') },
      NON_FORMULARY: { color: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#CD853F]', label: tr('خارج القائمة', 'Non-Formulary') },
      DISCONTINUED: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', label: tr('متوقف', 'Discontinued') },
      PENDING_REVIEW: { color: 'bg-[#E8A317]/10 text-[#E8A317] dark:bg-[#E8A317]/20 dark:text-[#E8A317]', label: tr('قيد المراجعة', 'Pending Review') },
    };
    const s = map[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  const boolBadge = (value: boolean | undefined, trueLabel: string, falseLabel: string, trueColor: string, falseColor: string) => {
    const color = value ? trueColor : falseColor;
    const label = value ? trueLabel : falseLabel;
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>{label}</span>;
  };

  const statusFilterLabel = (s: string) => {
    const map: Record<string, string> = {
      ACTIVE: tr('فعال', 'Active'),
      RESTRICTED: tr('مقيد', 'Restricted'),
      NON_FORMULARY: tr('خارج القائمة', 'Non-Formulary'),
      DISCONTINUED: tr('متوقف', 'Discontinued'),
      PENDING_REVIEW: tr('قيد المراجعة', 'Pending Review'),
    };
    return map[s] || s;
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {tr('قائمة الأدوية', 'Formulary')}
        </h1>
        <Button onClick={() => setCreateOpen(true)}>
          {tr('إضافة صنف', 'Add Item')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder={tr('بحث بالاسم أو الاسم العلمي...', 'Search by name or generic name...')}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white min-w-[260px]"
        />
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">{tr('جميع الحالات', 'All Statuses')}</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{statusFilterLabel(s)}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={controlledFilter === 'true'}
            onChange={e => { setControlledFilter(e.target.checked ? 'true' : ''); setPage(1); }}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          {tr('مواد خاضعة للرقابة فقط', 'Controlled Only')}
        </label>

        {/* Result count */}
        {!loading && (
          <span className="text-sm text-gray-500 dark:text-gray-400 ms-auto">
            {tr(`${total} صنف`, `${total} items`)}
          </span>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {tr('جارٍ التحميل...', 'Loading...')}
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {tr('لا توجد أصناف', 'No formulary items found')}
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {[
                  tr('رمز الصنف', 'Item Code'),
                  tr('اسم الصنف', 'Item Name'),
                  tr('الاسم العلمي', 'Generic Name'),
                  tr('الحالة', 'Status'),
                  tr('الفئة العلاجية', 'Therapeutic Class'),
                  tr('خاضع للرقابة', 'Controlled'),
                  tr('تغطية التأمين', 'Insurance'),
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
                  onClick={() => handleRowClick(row)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{row.itemCode}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.itemName || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {language === 'ar' && row.genericNameAr ? row.genericNameAr : (row.genericName || '-')}
                  </td>
                  <td className="px-4 py-3 text-sm">{statusBadge(row.formularyStatus)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.therapeuticClass || '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    {boolBadge(
                      row.isControlled,
                      tr('نعم', 'Yes'),
                      tr('لا', 'No'),
                      'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#CD853F]',
                      'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {boolBadge(
                      row.insuranceCovered,
                      tr('مغطى', 'Covered'),
                      tr('غير مغطى', 'Not Covered'),
                      'bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]',
                      'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                    )}
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

      {/* Create Dialog */}
      <FormularyFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={fetchData}
      />

      {/* Detail Sheet */}
      <FormularyDetailSheet
        item={selectedItem}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdated={fetchData}
      />
    </div>
  );
}
