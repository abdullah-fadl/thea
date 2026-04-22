'use client';

import { useLang } from '@/hooks/use-lang';
import { useEffect, useState, useCallback } from 'react';
import { Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PurchaseOrderFormDialog from '@/components/imdad/procurement/PurchaseOrderFormDialog';
import PurchaseOrderDetailSheet from '@/components/imdad/procurement/PurchaseOrderDetailSheet';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PurchaseOrder {
  _id?: string;
  id: string;
  poNumber: string;
  vendorId?: string;
  vendorName?: string;
  vendorNameAr?: string;
  vendor?: { id: string; name: string; nameAr?: string; code: string };
  totalAmount: number;
  currency: string;
  status: string;
  orderDate?: string;
  createdAt?: string;
  expectedDeliveryDate?: string;
  expectedDelivery?: string;
  version?: number;
  lines?: any[];
}

interface POResponse {
  data?: PurchaseOrder[];
  purchaseOrders?: PurchaseOrder[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_OPTIONS = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'SENT',
  'ACKNOWLEDGED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'INVOICED',
  'CANCELLED',
  'CLOSED',
] as const;

function statusBadge(status: string) {
  const map: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    PENDING_APPROVAL: 'bg-[#E8A317]/10 text-[#E8A317] dark:bg-[#E8A317]/20 dark:text-[#E8A317]',
    SUBMITTED: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#D4A017]/20 dark:text-[#E8A317]',
    APPROVED: 'bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]',
    SENT: 'bg-[#556B2F]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]',
    ACKNOWLEDGED: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#D4A017]/20 dark:text-[#E8A317]',
    PARTIALLY_RECEIVED: 'bg-[#E8A317]/10 text-[#C4960C] dark:bg-[#E8A317]/20 dark:text-[#E8A317]',
    RECEIVED: 'bg-[#6B8E23]/10 text-[#4A5D23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]',
    INVOICED: 'bg-[#556B2F]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]',
    CANCELLED: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#CD853F]',
    CLOSED: 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-500',
  };
  return map[status] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PurchaseOrdersPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Dialog / Sheet state
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingPO, setEditingPO] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (vendorFilter) params.set('vendorId', vendorFilter);
      if (dateFrom) params.set('startDate', dateFrom);
      if (dateTo) params.set('endDate', dateTo);

      const res = await fetch(`/api/imdad/procurement/purchase-orders?${params}`);
      if (res.ok) {
        const json: POResponse = await res.json();
        setOrders(json.data ?? json.purchaseOrders ?? []);
        setTotal(json.total ?? 0);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, vendorFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.ceil(total / limit) || 1;

  const statusTr: Record<string, [string, string]> = {
    DRAFT: ['مسودة', 'Draft'],
    PENDING_APPROVAL: ['بانتظار الموافقة', 'Pending Approval'],
    SUBMITTED: ['مقدم', 'Submitted'],
    APPROVED: ['معتمد', 'Approved'],
    SENT: ['مرسل', 'Sent'],
    ACKNOWLEDGED: ['تم الاستلام', 'Acknowledged'],
    PARTIALLY_RECEIVED: ['مستلم جزئياً', 'Partially Received'],
    RECEIVED: ['مستلم', 'Received'],
    INVOICED: ['مفوتر', 'Invoiced'],
    CANCELLED: ['ملغي', 'Cancelled'],
    CLOSED: ['مغلق', 'Closed'],
  };

  function handleCreatePO() {
    setFormMode('create');
    setEditingPO(null);
    setFormOpen(true);
  }

  function handleEditPO(po: any) {
    setFormMode('edit');
    setEditingPO(po);
    setFormOpen(true);
  }

  function handleRowClick(po: PurchaseOrder) {
    setSelectedPoId(po.id || po._id || '');
    setDetailOpen(true);
  }

  function handleSuccess() {
    fetchData();
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {tr('أوامر الشراء', 'Purchase Orders')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {tr('إدارة ومتابعة أوامر الشراء', 'Manage and track purchase orders')}
          </p>
        </div>
        <Button onClick={handleCreatePO}>
          <Plus className="h-4 w-4 me-2" />
          {tr('أمر شراء جديد', 'New PO')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={tr('بحث برقم أمر الشراء...', 'Search by PO number...')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 ps-10 pe-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">{tr('جميع الحالات', 'All Statuses')}</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {tr(statusTr[s]?.[0] ?? s, statusTr[s]?.[1] ?? s)}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder={tr('تصفية بالمورد...', 'Filter by vendor...')}
          value={vendorFilter}
          onChange={(e) => {
            setVendorFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          title={tr('من تاريخ', 'From date')}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          title={tr('إلى تاريخ', 'To date')}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              {[
                tr('رقم أمر الشراء', 'PO Number'),
                tr('المورد', 'Vendor'),
                tr('المبلغ الإجمالي', 'Total Amount'),
                tr('العملة', 'Currency'),
                tr('الحالة', 'Status'),
                tr('تاريخ الطلب', 'Order Date'),
                tr('التسليم المتوقع', 'Expected Delivery'),
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    </td>
                  ))}
                </tr>
              ))
            ) : orders.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  {tr('لا توجد أوامر شراء', 'No purchase orders found')}
                </td>
              </tr>
            ) : (
              orders.map((o) => {
                const vendorDisplay =
                  o.vendor
                    ? language === 'ar' && o.vendor.nameAr
                      ? o.vendor.nameAr
                      : o.vendor.name
                    : language === 'ar' && o.vendorNameAr
                    ? o.vendorNameAr
                    : o.vendorName || '—';

                const orderDate = o.orderDate || o.createdAt;
                const expectedDelivery = o.expectedDeliveryDate || o.expectedDelivery;

                return (
                  <tr
                    key={o.id || o._id}
                    onClick={() => handleRowClick(o)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-[#D4A017] dark:text-[#E8A317]">
                      {o.poNumber}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {vendorDisplay}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {Number(o.totalAmount || 0).toLocaleString(
                        language === 'ar' ? 'ar-SA' : 'en-SA',
                        { minimumFractionDigits: 2 }
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {o.currency}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(o.status)}`}
                      >
                        {tr(
                          statusTr[o.status]?.[0] ?? o.status,
                          statusTr[o.status]?.[1] ?? o.status
                        )}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {orderDate
                        ? new Date(orderDate).toLocaleDateString(
                            language === 'ar' ? 'ar-SA' : 'en-SA'
                          )
                        : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {expectedDelivery
                        ? new Date(expectedDelivery).toLocaleDateString(
                            language === 'ar' ? 'ar-SA' : 'en-SA'
                          )
                        : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr(
              `عرض ${(page - 1) * limit + 1} - ${Math.min(page * limit, total)} من ${total}`,
              `Showing ${(page - 1) * limit + 1} - ${Math.min(page * limit, total)} of ${total}`
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-gray-300 p-2 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {tr(`${page} من ${totalPages}`, `${page} of ${totalPages}`)}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-gray-300 p-2 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <PurchaseOrderFormDialog
        mode={formMode}
        po={editingPO}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={handleSuccess}
      />

      {/* Detail Sheet */}
      <PurchaseOrderDetailSheet
        poId={selectedPoId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={handleEditPO}
        onStatusChange={handleSuccess}
      />
    </div>
  );
}
