'use client';

import { useLang } from '@/hooks/use-lang';
import { useEffect, useState, useCallback } from 'react';
import { Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GRNFormDialog from '@/components/imdad/warehouse/GRNFormDialog';
import GRNDetailSheet from '@/components/imdad/warehouse/GRNDetailSheet';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GRN {
  _id?: string;
  id: string;
  grnNumber: string;
  status: string;
  purchaseOrder?: { id: string; poNumber: string };
  vendorId?: string;
  receivedAt?: string;
  qualityStatus?: string;
  createdAt?: string;
  lines?: any[];
  version?: number;
}

const STATUS_OPTIONS = ['DRAFT', 'PENDING_QC', 'RECEIVED', 'VERIFIED', 'ACCEPTED', 'PARTIALLY_ACCEPTED', 'COMPLETED', 'REJECTED', 'CANCELLED'] as const;

function statusBadgeColor(status: string) {
  const map: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    PENDING_QC: 'bg-[#E8A317]/15 text-[#C4960C] dark:bg-[#E8A317]/20 dark:text-[#E8A317]',
    RECEIVED: 'bg-[#D4A017]/15 text-[#C4960C] dark:bg-[#C4960C]/20 dark:text-[#E8A317]',
    VERIFIED: 'bg-[#556B2F]/15 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]',
    ACCEPTED: 'bg-[#6B8E23]/15 text-[#4A5D23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]',
    PARTIALLY_ACCEPTED: 'bg-[#E8A317]/15 text-[#C4960C] dark:bg-[#E8A317]/20 dark:text-[#E8A317]',
    COMPLETED: 'bg-[#6B8E23]/15 text-[#4A5D23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]',
    REJECTED: 'bg-[#8B4513]/15 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#D4A017]',
    CANCELLED: 'bg-[#8B4513]/15 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#D4A017]',
  };
  return map[status] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReceivingPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [data, setData] = useState<GRN[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const limit = 20;

  // Dialogs
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGrnId, setSelectedGrnId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const statusTr: Record<string, [string, string]> = {
    DRAFT: ['مسودة', 'Draft'],
    PENDING_QC: ['بانتظار فحص الجودة', 'Pending QC'],
    RECEIVED: ['مستلم', 'Received'],
    VERIFIED: ['تم التحقق', 'Verified'],
    ACCEPTED: ['مقبول', 'Accepted'],
    PARTIALLY_ACCEPTED: ['مقبول جزئياً', 'Partially Accepted'],
    COMPLETED: ['مكتمل', 'Completed'],
    REJECTED: ['مرفوض', 'Rejected'],
    CANCELLED: ['ملغي', 'Cancelled'],
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/imdad/procurement/grn?${params}`, { credentials: 'include' });
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
  }, [page, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fmtDate = (d: any) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  function handleRowClick(grn: GRN) {
    setSelectedGrnId(grn.id || grn._id || null);
    setShowDetail(true);
  }

  // Filter locally by search
  const filtered = search
    ? data.filter(
        (g) =>
          g.grnNumber?.toLowerCase().includes(search.toLowerCase()) ||
          g.purchaseOrder?.poNumber?.toLowerCase().includes(search.toLowerCase())
      )
    : data;

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {tr('استلام البضائع', 'Goods Receiving')}
        </h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 me-2" />
          {tr('إنشاء إذن استلام', 'Create GRN')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={tr('بحث...', 'Search...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded-lg ps-10 pe-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">{tr('جميع الحالات', 'All Statuses')}</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {tr(statusTr[s]?.[0] ?? s, statusTr[s]?.[1] ?? s)}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {tr('جارٍ التحميل...', 'Loading...')}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {tr('لا توجد إذونات استلام', 'No receiving notes found')}
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {[
                  tr('رقم الإذن', 'GRN #'),
                  tr('أمر الشراء', 'PO #'),
                  tr('الحالة', 'Status'),
                  tr('حالة الجودة', 'Quality'),
                  tr('عدد البنود', 'Lines'),
                  tr('تاريخ الاستلام', 'Received Date'),
                  tr('تاريخ الإنشاء', 'Created'),
                ].map((h, i) => (
                  <th
                    key={i}
                    className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-start"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.map((row) => (
                <tr
                  key={row.id || row._id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                  onClick={() => handleRowClick(row)}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {row.grnNumber}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {row.purchaseOrder?.poNumber || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadgeColor(row.status)}`}
                    >
                      {tr(statusTr[row.status]?.[0] ?? row.status, statusTr[row.status]?.[1] ?? row.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {row.qualityStatus || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {row.lines?.length ?? 0}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {fmtDate(row.receivedAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {fmtDate(row.createdAt)}
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
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            >
              <ChevronLeft className="h-4 w-4 inline" />
              {tr('السابق', 'Previous')}
            </button>
            <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
              {tr(`صفحة ${page} من ${totalPages}`, `Page ${page} of ${totalPages}`)}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            >
              {tr('التالي', 'Next')}
              <ChevronRight className="h-4 w-4 inline" />
            </button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <GRNFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSuccess={fetchData}
      />

      {/* Detail Sheet */}
      <GRNDetailSheet
        grnId={selectedGrnId}
        open={showDetail}
        onOpenChange={setShowDetail}
        onStatusChange={fetchData}
      />
    </div>
  );
}
