'use client';

import { useLang } from '@/hooks/use-lang';
import { useEffect, useState, useCallback } from 'react';

interface PaymentInvoice {
  invoiceNumber: string;
  totalAmount: number;
  status: string;
}

interface Payment {
  id: string;
  batchNumber: string;
  vendorId: string;
  vendorName: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency?: string;
  paymentMethod: string;
  paymentReference?: string;
  paymentDate: string;
  status: string;
  bankName?: string;
  notes?: string;
  invoice?: PaymentInvoice;
  createdAt: string;
}

interface PaymentsResponse {
  items: Payment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const PAYMENT_STATUSES = ['PENDING', 'APPROVED', 'SUBMITTED', 'PROCESSED', 'FAILED', 'CANCELLED'] as const;
const PAYMENT_METHODS = ['BANK_TRANSFER', 'CHECK', 'ELECTRONIC', 'CREDIT_CARD', 'CASH'] as const;

const statusLabelsAr: Record<string, string> = {
  PENDING: 'معلق',
  APPROVED: 'معتمد',
  SUBMITTED: 'مقدم',
  PROCESSED: 'تمت المعالجة',
  FAILED: 'فشل',
  CANCELLED: 'ملغي',
};

const methodLabelsAr: Record<string, string> = {
  BANK_TRANSFER: 'تحويل بنكي',
  CHECK: 'شيك',
  ELECTRONIC: 'إلكتروني',
  CREDIT_CARD: 'بطاقة ائتمان',
  CASH: 'نقدي',
};

const methodLabelsEn: Record<string, string> = {
  BANK_TRANSFER: 'Bank Transfer',
  CHECK: 'Check',
  ELECTRONIC: 'Electronic',
  CREDIT_CARD: 'Credit Card',
  CASH: 'Cash',
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR' }).format(amount);
}

function formatDate(dateStr: string, lang: string = 'en') {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-SA');
}

function StatusBadge({ status, tr }: { status: string; tr: (ar: string, en: string) => string }) {
  const map: Record<string, { label: [string, string]; cls: string }> = {
    PENDING: { label: ['معلق', 'Pending'], cls: 'bg-[#E8A317]/10 text-[#E8A317] dark:bg-[#E8A317]/20 dark:text-[#E8A317]' },
    APPROVED: { label: ['معتمد', 'Approved'], cls: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#D4A017]/20 dark:text-[#E8A317]' },
    SUBMITTED: { label: ['مقدم', 'Submitted'], cls: 'bg-[#556B2F]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]' },
    PROCESSED: { label: ['تمت المعالجة', 'Processed'], cls: 'bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]' },
    FAILED: { label: ['فشل', 'Failed'], cls: 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#CD853F]' },
    CANCELLED: { label: ['ملغي', 'Cancelled'], cls: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  };
  const entry = map[status] ?? { label: [status, status], cls: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${entry.cls}`}>
      {tr(entry.label[0], entry.label[1])}
    </span>
  );
}

function MethodBadge({ method, tr }: { method: string; tr: (ar: string, en: string) => string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
      {tr(methodLabelsAr[method] || method, methodLabelsEn[method] || method)}
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
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
        </div>
      ))}
    </div>
  );
}

export default function PaymentsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMethod, setFilterMethod] = useState('');

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (filterStatus) params.set('status', filterStatus);
      if (filterMethod) params.set('paymentMethod', filterMethod);
      if (search) params.set('search', search);
      const res = await fetch(`/api/imdad/financial/payments?${params}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterMethod, search]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {tr('المدفوعات', 'Payments')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {tr('إدارة ومتابعة دفعات الموردين', 'Manage and track vendor payment batches')}
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-[#D4A017] px-4 py-2 text-sm font-medium text-white hover:bg-[#C4960C] focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          {tr('إنشاء دفعة', 'Create Payment')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={tr('بحث برقم الدفعة أو اسم المورد', 'Search by payment number or vendor name')}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white placeholder:text-gray-400 min-w-[260px]"
        />
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">{tr('جميع الحالات', 'All Statuses')}</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{tr(statusLabelsAr[s] || s, s)}</option>
          ))}
        </select>
        <select
          value={filterMethod}
          onChange={(e) => { setFilterMethod(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">{tr('جميع طرق الدفع', 'All Methods')}</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>{tr(methodLabelsAr[m] || m, methodLabelsEn[m] || m)}</option>
          ))}
        </select>
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
              {tr('لا توجد مدفوعات', 'No payments found')}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {tr('رقم الدفعة', 'Payment #')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {tr('الفاتورة', 'Invoice')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {tr('المورد', 'Vendor')}
                </th>
                <th className="px-4 py-3 text-end font-medium text-gray-600 dark:text-gray-400">
                  {tr('المبلغ (ر.س)', 'Amount (SAR)')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {tr('طريقة الدفع', 'Method')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {tr('الحالة', 'Status')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {tr('التاريخ', 'Date')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data.items.map((payment) => (
                <tr
                  key={payment.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-750"
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-900 dark:text-white">
                    {payment.batchNumber}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                    {payment.invoiceNumber || payment.invoice?.invoiceNumber || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">
                    {payment.vendorName}
                  </td>
                  <td className="px-4 py-3 text-end font-medium text-gray-900 dark:text-white">
                    {formatCurrency(payment.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <MethodBadge method={payment.paymentMethod} tr={tr} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={payment.status} tr={tr} />
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {formatDate(payment.paymentDate, language)}
                  </td>
                </tr>
              ))}
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
