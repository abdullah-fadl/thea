'use client';

import { useState, useMemo } from 'react';
import { useLang } from '@/hooks/use-lang';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2, XCircle, Loader2, Search, Filter, ClipboardCheck,
} from 'lucide-react';

interface PendingPO {
  id: string;
  poNumber: string;
  vendorName: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  requestedBy: string;
  requestedByName: string;
}

interface ApproveResult {
  approved: number;
  failed: { id: string; reason: string }[];
}

export default function BulkApprovePOsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const qc = useQueryClient();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [vendorFilter, setVendorFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<ApproveResult | null>(null);

  const { data: pendingPOs = [], isLoading } = useQuery<PendingPO[]>({
    queryKey: ['imdad', 'pending-pos'],
    queryFn: async () => {
      const res = await fetch('/api/imdad/procurement/purchase-orders?status=PENDING_APPROVAL', {
        credentials: 'include',
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.items ?? data ?? [];
    },
  });

  const filtered = useMemo(() => {
    return pendingPOs.filter((po) => {
      if (vendorFilter && !po.vendorName?.toLowerCase().includes(vendorFilter.toLowerCase())) return false;
      if (dateFrom && po.createdAt < dateFrom) return false;
      if (dateTo && po.createdAt > dateTo + 'T23:59:59') return false;
      return true;
    });
  }, [pendingPOs, vendorFilter, dateFrom, dateTo]);

  const allSelected = filtered.length > 0 && filtered.every((po) => selected.has(po.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((po) => po.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const approveMutation = useMutation({
    mutationFn: async (poIds: string[]) => {
      const res = await fetch('/api/imdad/bulk/approve-pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ poIds, notes: approvalNotes || undefined }),
      });
      if (!res.ok) throw new Error('Approval failed');
      return res.json() as Promise<ApproveResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setSelected(new Set());
      setShowConfirm(false);
      setApprovalNotes('');
      qc.invalidateQueries({ queryKey: ['imdad', 'pending-pos'] });
    },
    onError: () => {
      setResult({ approved: 0, failed: [{ id: '-', reason: tr('خطأ في الاتصال', 'Connection error') }] });
      setShowConfirm(false);
    },
  });

  const handleApprove = () => {
    approveMutation.mutate(Array.from(selected));
  };

  const formatCurrency = (amount: number, currency = 'SAR') =>
    new Intl.NumberFormat(language === 'ar' ? 'ar-SA' : 'en-SA', {
      style: 'currency',
      currency,
    }).format(amount);

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#556B2F]/10 dark:bg-[#556B2F]/20">
          <ClipboardCheck className="h-5 w-5 text-[#556B2F] dark:text-[#9CB86B]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {tr('اعتماد أوامر الشراء بالجملة', 'Bulk Approve Purchase Orders')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr('اختر أوامر الشراء المعلقة واعتمدها دفعة واحدة', 'Select pending POs and approve them in one batch')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{tr('تصفية', 'Filters')}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute start-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              placeholder={tr('بحث بالمورد...', 'Search by vendor...')}
              className="w-full rounded-lg border border-gray-300 bg-white ps-9 pe-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            placeholder={tr('من تاريخ', 'From date')}
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            placeholder={tr('إلى تاريخ', 'To date')}
          />
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {tr(`${selected.size} محدد من ${filtered.length}`, `${selected.size} of ${filtered.length} selected`)}
        </span>
        <button
          disabled={selected.size === 0 || approveMutation.isPending}
          onClick={() => setShowConfirm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#556B2F] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#4A5D23] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {tr('اعتماد المحدد', 'Approve Selected')}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ms-2 text-sm text-gray-500">{tr('جارٍ التحميل...', 'Loading...')}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            {tr('لا توجد أوامر شراء معلقة', 'No pending purchase orders')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-start">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-gray-300 text-[#556B2F] focus:ring-[#556B2F]"
                    />
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-gray-700 dark:text-gray-300">
                    {tr('رقم الأمر', 'PO Number')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-gray-700 dark:text-gray-300">
                    {tr('المورد', 'Vendor')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-gray-700 dark:text-gray-300">
                    {tr('المبلغ', 'Amount')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-gray-700 dark:text-gray-300">
                    {tr('التاريخ', 'Date')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-gray-700 dark:text-gray-300">
                    {tr('مقدم الطلب', 'Requested By')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filtered.map((po) => (
                  <tr
                    key={po.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${selected.has(po.id) ? 'bg-[#556B2F]/5 dark:bg-[#556B2F]/10' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(po.id)}
                        onChange={() => toggleOne(po.id)}
                        className="h-4 w-4 rounded border-gray-300 text-[#556B2F] focus:ring-[#556B2F]"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-900 dark:text-white">{po.poNumber}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{po.vendorName}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {formatCurrency(po.totalAmount, po.currency)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(po.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{po.requestedByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Result banner */}
      {result && (
        <div className="rounded-xl border p-4 space-y-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {result.approved > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#556B2F] dark:text-[#9CB86B]">
                <CheckCircle2 className="h-4 w-4" />
                {tr(`تم اعتماد ${result.approved}`, `${result.approved} approved`)}
              </span>
            )}
            {result.failed.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#8B4513] dark:text-[#CD853F]">
                <XCircle className="h-4 w-4" />
                {tr(`فشل ${result.failed.length}`, `${result.failed.length} failed`)}
              </span>
            )}
          </div>
          {result.failed.length > 0 && (
            <ul className="text-sm text-[#8B4513] dark:text-[#CD853F] space-y-1 list-disc list-inside">
              {result.failed.map((f, i) => (
                <li key={i}>{f.reason}</li>
              ))}
            </ul>
          )}
          <button
            onClick={() => setResult(null)}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            {tr('إخفاء', 'Dismiss')}
          </button>
        </div>
      )}

      {/* Confirmation dialog overlay */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {tr('تأكيد الاعتماد', 'Confirm Approval')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {tr(
                `هل أنت متأكد من اعتماد ${selected.size} أمر شراء؟`,
                `Are you sure you want to approve ${selected.size} purchase order(s)?`
              )}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {tr('ملاحظات (اختياري)', 'Notes (optional)')}
              </label>
              <textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder={tr('أضف ملاحظات للاعتماد...', 'Add approval notes...')}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {tr('إلغاء', 'Cancel')}
              </button>
              <button
                onClick={handleApprove}
                disabled={approveMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-[#556B2F] px-4 py-2 text-sm font-medium text-white hover:bg-[#4A5D23] disabled:opacity-50"
              >
                {approveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {tr('اعتماد', 'Approve')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
