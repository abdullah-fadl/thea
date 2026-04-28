'use client';

import { useState } from 'react';
import { useLang } from '@/hooks/use-lang';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Plus, Trash2, Loader2, CheckCircle2, XCircle, PackageMinus,
  AlertTriangle, Send,
} from 'lucide-react';

interface AdjustmentRow {
  id: string;
  itemId: string;
  itemLabel: string;
  locationId: string;
  locationLabel: string;
  organizationId: string;
  adjustmentType: 'ADD' | 'SUBTRACT' | 'SET';
  quantity: number;
  reason: string;
  notes: string;
}

interface AdjustmentResult {
  created: number;
  failed: { index: number; reason: string }[];
}

const REASONS = [
  { value: 'PHYSICAL_COUNT', ar: 'جرد فعلي', en: 'Physical Count' },
  { value: 'DAMAGE', ar: 'تالف', en: 'Damage' },
  { value: 'EXPIRY', ar: 'انتهاء صلاحية', en: 'Expiry' },
  { value: 'THEFT', ar: 'سرقة', en: 'Theft' },
  { value: 'SYSTEM_CORRECTION', ar: 'تصحيح نظام', en: 'System Correction' },
  { value: 'RETURN', ar: 'إرجاع', en: 'Return' },
  { value: 'DONATION', ar: 'تبرع', en: 'Donation' },
  { value: 'SAMPLE', ar: 'عينة', en: 'Sample' },
  { value: 'TRANSFER_CORRECTION', ar: 'تصحيح نقل', en: 'Transfer Correction' },
  { value: 'OTHER', ar: 'أخرى', en: 'Other' },
];

let rowCounter = 0;
const makeRow = (): AdjustmentRow => ({
  id: `row-${++rowCounter}`,
  itemId: '',
  itemLabel: '',
  locationId: '',
  locationLabel: '',
  organizationId: '',
  adjustmentType: 'ADD',
  quantity: 0,
  reason: 'PHYSICAL_COUNT',
  notes: '',
});

export default function BulkStockAdjustmentPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [rows, setRows] = useState<AdjustmentRow[]>([makeRow()]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<AdjustmentResult | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');

  const { data: items = [] } = useQuery({
    queryKey: ['imdad', 'items-lookup', itemSearch],
    queryFn: async () => {
      const res = await fetch(`/api/imdad/inventory/items?search=${encodeURIComponent(itemSearch)}&limit=50`, {
        credentials: 'include',
      });
      if (!res.ok) return [];
      const d = await res.json();
      return d.items ?? d ?? [];
    },
    enabled: true,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['imdad', 'locations-lookup', locationSearch],
    queryFn: async () => {
      const res = await fetch(`/api/imdad/inventory/locations?search=${encodeURIComponent(locationSearch)}&limit=50`, {
        credentials: 'include',
      });
      if (!res.ok) return [];
      const d = await res.json();
      return d.items ?? d ?? [];
    },
    enabled: true,
  });

  const updateRow = (id: string, field: keyof AdjustmentRow, value: any) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const addRow = () => setRows((prev) => [...prev, makeRow()]);
  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const adjustMutation = useMutation({
    mutationFn: async () => {
      const adjustments = rows
        .filter((r) => r.itemId && r.locationId && r.quantity !== 0)
        .map((r) => ({
          itemId: r.itemId,
          locationId: r.locationId,
          organizationId: r.organizationId,
          quantityChange:
            r.adjustmentType === 'SUBTRACT' ? -Math.abs(r.quantity) : r.quantity,
          reason: r.reason,
          notes: r.notes || undefined,
        }));
      const res = await fetch('/api/imdad/bulk/stock-adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ adjustments }),
      });
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<AdjustmentResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setShowConfirm(false);
    },
    onError: () => {
      setResult({ created: 0, failed: [{ index: -1, reason: tr('خطأ في الاتصال', 'Connection error') }] });
      setShowConfirm(false);
    },
  });

  const validRows = rows.filter((r) => r.itemId && r.locationId && r.quantity !== 0);

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
          <PackageMinus className="h-5 w-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {tr('تسوية المخزون بالجملة', 'Bulk Stock Adjustment')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr('أضف عدة تسويات مخزون وأرسلها دفعة واحدة', 'Add multiple stock adjustments and submit them in one batch')}
          </p>
        </div>
      </div>

      {/* Adjustment rows */}
      <div className="space-y-3">
        {rows.map((row, idx) => (
          <div
            key={row.id}
            className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {tr(`تسوية #${idx + 1}`, `Adjustment #${idx + 1}`)}
              </span>
              {rows.length > 1 && (
                <button
                  onClick={() => removeRow(row.id)}
                  className="text-gray-400 hover:text-[#8B4513] transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Item selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {tr('الصنف', 'Item')} <span className="text-[#8B4513]">*</span>
                </label>
                <select
                  value={row.itemId}
                  onChange={(e) => {
                    const item = items.find((i: any) => i.id === e.target.value);
                    updateRow(row.id, 'itemId', e.target.value);
                    updateRow(row.id, 'itemLabel', item?.name ?? '');
                    updateRow(row.id, 'organizationId', item?.organizationId ?? '');
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">{tr('اختر صنف...', 'Select item...')}</option>
                  {items.map((item: any) => (
                    <option key={item.id} value={item.id}>
                      {item.code} - {language === 'ar' ? (item.nameAr || item.name) : item.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {tr('المستودع', 'Warehouse')} <span className="text-[#8B4513]">*</span>
                </label>
                <select
                  value={row.locationId}
                  onChange={(e) => updateRow(row.id, 'locationId', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">{tr('اختر مستودع...', 'Select warehouse...')}</option>
                  {locations.map((loc: any) => (
                    <option key={loc.id} value={loc.id}>
                      {language === 'ar' ? (loc.nameAr || loc.name) : loc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Adjustment type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {tr('نوع التسوية', 'Adjustment Type')}
                </label>
                <select
                  value={row.adjustmentType}
                  onChange={(e) => updateRow(row.id, 'adjustmentType', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value="ADD">{tr('إضافة (+)', 'Add (+)')}</option>
                  <option value="SUBTRACT">{tr('خصم (-)', 'Subtract (-)')}</option>
                  <option value="SET">{tr('تعيين (=)', 'Set (=)')}</option>
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {tr('الكمية', 'Quantity')} <span className="text-[#8B4513]">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={row.quantity || ''}
                  onChange={(e) => updateRow(row.id, 'quantity', parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {tr('السبب', 'Reason')}
                </label>
                <select
                  value={row.reason}
                  onChange={(e) => updateRow(row.id, 'reason', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>{tr(r.ar, r.en)}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {tr('ملاحظات', 'Notes')}
                </label>
                <input
                  type="text"
                  value={row.notes}
                  onChange={(e) => updateRow(row.id, 'notes', e.target.value)}
                  placeholder={tr('اختياري...', 'Optional...')}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add row + submit */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={addRow}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <Plus className="h-4 w-4" />
          {tr('إضافة سطر', 'Add Row')}
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {tr(`${validRows.length} تسوية صالحة`, `${validRows.length} valid adjustment(s)`)}
          </span>
          <button
            disabled={validRows.length === 0 || adjustMutation.isPending}
            onClick={() => setShowConfirm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" />
            {tr('إرسال التسويات', 'Submit Adjustments')}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {tr('نتائج التسوية', 'Adjustment Results')}
          </h3>
          <div className="flex items-center gap-4">
            {result.created > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#556B2F] dark:text-[#9CB86B]">
                <CheckCircle2 className="h-4 w-4" />
                {tr(`تم إنشاء ${result.created} تسوية`, `${result.created} adjustment(s) created`)}
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-3 py-2 text-start font-medium text-gray-700 dark:text-gray-300">{tr('الفهرس', 'Index')}</th>
                    <th className="px-3 py-2 text-start font-medium text-gray-700 dark:text-gray-300">{tr('السبب', 'Reason')}</th>
                    <th className="px-3 py-2 text-start font-medium text-gray-700 dark:text-gray-300">{tr('الحالة', 'Status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {result.failed.map((f, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{f.index >= 0 ? f.index + 1 : '-'}</td>
                      <td className="px-3 py-2 text-[#8B4513] dark:text-[#CD853F]">{f.reason}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#8B4513]/10 px-2 py-0.5 text-xs font-medium text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#CD853F]">
                          <XCircle className="h-3 w-3" /> {tr('فشل', 'Failed')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button
            onClick={() => setResult(null)}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            {tr('إخفاء', 'Dismiss')}
          </button>
        </div>
      )}

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {tr('تأكيد التسويات', 'Confirm Adjustments')}
              </h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {tr(
                `هل أنت متأكد من إرسال ${validRows.length} تسوية مخزون؟ لا يمكن التراجع عن هذا الإجراء.`,
                `Are you sure you want to submit ${validRows.length} stock adjustment(s)? This action cannot be undone.`
              )}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {tr('إلغاء', 'Cancel')}
              </button>
              <button
                onClick={() => adjustMutation.mutate()}
                disabled={adjustMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {adjustMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {tr('تأكيد', 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
