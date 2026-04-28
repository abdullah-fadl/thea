'use client';

import { useLang } from '@/hooks/use-lang';
import { useEffect, useState, useCallback } from 'react';

interface Invoice {
  id: string;
  invoiceNumber: string;
  internalNumber: string;
  vendorId: string;
  vendorName: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: string;
  isMatched: boolean;
}

interface InvoicesResponse {
  items: Invoice[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const INVOICE_STATUSES = ['DRAFT', 'RECEIVED', 'VERIFIED', 'MATCHED', 'APPROVED', 'PAID'];

const invoiceStatusLabelsAr: Record<string, string> = {
  DRAFT: 'مسودة',
  RECEIVED: 'مستلمة',
  VERIFIED: 'تم التحقق',
  MATCHED: 'مطابقة',
  APPROVED: 'معتمدة',
  PAID: 'مدفوعة',
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR' }).format(amount);
}

function formatDate(dateStr: string, lang: string = 'en') {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-SA');
}

function isOverdue(dueDate: string, status: string) {
  if (status === 'PAID') return false;
  return new Date(dueDate) < new Date();
}

function StatusBadge({ status, tr }: { status: string; tr: (ar: string, en: string) => string }) {
  const map: Record<string, { label: [string, string]; cls: string }> = {
    DRAFT: { label: ['مسودة', 'Draft'], cls: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
    RECEIVED: { label: ['مستلمة', 'Received'], cls: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#D4A017]/20 dark:text-[#E8A317]' },
    VERIFIED: { label: ['تم التحقق', 'Verified'], cls: 'bg-[#556B2F]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]' },
    MATCHED: { label: ['مطابقة', 'Matched'], cls: 'bg-[#556B2F]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]' },
    APPROVED: { label: ['معتمدة', 'Approved'], cls: 'bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]' },
    PAID: { label: ['مدفوعة', 'Paid'], cls: 'bg-[#6B8E23]/10 text-[#4A5D23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]' },
  };
  const entry = map[status] ?? { label: [status, status], cls: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${entry.cls}`}>
      {tr(entry.label[0], entry.label[1])}
    </span>
  );
}

function MatchBadge({ matched, tr }: { matched: boolean; tr: (ar: string, en: string) => string }) {
  return matched ? (
    <span className="inline-flex items-center rounded-full bg-[#6B8E23]/10 px-2 py-0.5 text-xs font-medium text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]">
      {tr('مطابقة', 'Matched')}
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-[#E8A317]/10 px-2 py-0.5 text-xs font-medium text-[#E8A317] dark:bg-[#E8A317]/20 dark:text-[#E8A317]">
      {tr('غير مطابقة', 'Unmatched')}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-28" />
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
        </div>
      ))}
    </div>
  );
}

export default function InvoicesPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [data, setData] = useState<InvoicesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (filterStatus) params.set('status', filterStatus);
      if (filterVendor) params.set('vendorId', filterVendor);
      if (startDate) params.set('startDate', new Date(startDate).toISOString());
      if (endDate) params.set('endDate', new Date(endDate).toISOString());
      const res = await fetch(`/api/imdad/financial/invoices?${params}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterVendor, startDate, endDate]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {tr('الفواتير', 'Invoices')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {tr('إدارة ومتابعة فواتير الموردين', 'Manage and track vendor invoices')}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">{tr('جميع الحالات', 'All Statuses')}</option>
          {INVOICE_STATUSES.map((s) => (
            <option key={s} value={s}>{tr(invoiceStatusLabelsAr[s] || s, s)}</option>
          ))}
        </select>
        <input
          type="text"
          value={filterVendor}
          onChange={(e) => { setFilterVendor(e.target.value); setPage(1); }}
          placeholder={tr('معرف المورد', 'Vendor ID')}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white placeholder:text-gray-400"
        />
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">{tr('من', 'From')}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">{tr('إلى', 'To')}</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-x-auto">
        {loading ? (
          <div className="p-6">
            <LoadingSkeleton />
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr('لا توجد فواتير', 'No invoices found')}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {tr('رقم الفاتورة', 'Invoice Number')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {tr('الرقم الداخلي', 'Internal Number')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {tr('المورد', 'Vendor')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {tr('تاريخ الفاتورة', 'Invoice Date')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {tr('تاريخ الاستحقاق', 'Due Date')}
                </th>
                <th className="px-4 py-3 text-end font-medium text-gray-600 dark:text-gray-400">
                  {tr('المبلغ الإجمالي', 'Total Amount')}
                </th>
                <th className="px-4 py-3 text-end font-medium text-gray-600 dark:text-gray-400">
                  {tr('المدفوع', 'Paid Amount')}
                </th>
                <th className="px-4 py-3 text-end font-medium text-gray-600 dark:text-gray-400">
                  {tr('الرصيد', 'Balance')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {tr('الحالة', 'Status')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {tr('المطابقة', 'Match Status')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data.items.map((inv) => {
                const overdue = isOverdue(inv.dueDate, inv.status);
                return (
                  <tr
                    key={inv.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-750 ${
                      overdue ? 'bg-[#8B4513]/5 dark:bg-[#8B4513]/10' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-900 dark:text-white">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                      {inv.internalNumber}
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white">
                      {inv.vendorName}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {formatDate(inv.invoiceDate, language)}
                    </td>
                    <td className={`px-4 py-3 ${overdue ? 'text-[#8B4513] font-medium dark:text-[#CD853F]' : 'text-gray-600 dark:text-gray-400'}`}>
                      {formatDate(inv.dueDate, language)}
                      {overdue && (
                        <span className="ml-1 text-xs text-[#8B4513]">
                          ({tr('متأخرة', 'Overdue')})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end font-medium text-gray-900 dark:text-white">
                      {formatCurrency(inv.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-end text-gray-600 dark:text-gray-400">
                      {formatCurrency(inv.paidAmount)}
                    </td>
                    <td className={`px-4 py-3 text-end font-medium ${
                      inv.balanceDue > 0
                        ? 'text-[#E8A317] dark:text-[#E8A317]'
                        : 'text-[#6B8E23] dark:text-[#9CB86B]'
                    }`}>
                      {formatCurrency(inv.balanceDue)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={inv.status} tr={tr} />
                    </td>
                    <td className="px-4 py-3">
                      <MatchBadge matched={inv.isMatched} tr={tr} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr('الصفحة', 'Page')} {data.page} {tr('من', 'of')} {data.totalPages} ({data.total} {tr('سجل', 'records')})
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {tr('السابق', 'Previous')}
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page >= data.totalPages}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {tr('التالي', 'Next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
